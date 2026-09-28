import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { FieldValue, getFirebaseFirestore, type Timestamp } from "@ctrlp/firebase/firestore";
import type {
  CheckoutOrderRequestInput,
  OrderTransitionRequestInput,
  RejectOrderRequestInput,
} from "@ctrlp/schemas";
import type { AuthSessionUser } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { getShopConfig, quoteDocumentPrint } from "@/src/modules/shops/shop-config.service";

const FIRST_ORDER_SEQUENCE = 1041;

type OrderStatus =
  | "SUBMITTED"
  | "SHOP_ACCEPTED"
  | "PRINTING"
  | "READY"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

type TransitionAction = "accept" | "reject" | "printing" | "ready" | "complete" | "cancel";

export type OrderDto = {
  id: string;
  orderNumber: string;
  shopId: string;
  printUserId: string;
  customerPhone: string | null;
  status: OrderStatus;
  pickupCode: string;
  amounts: {
    subtotalMinorUnits: number;
    taxMinorUnits: number;
    totalMinorUnits: number;
  };
  payment: {
    method: "CASH" | "ONLINE";
    status: "PENDING" | "PAID";
  };
  documents: Array<{
    id: string;
    originalFilename: string;
    pageCount: number;
    copies: number;
    colorMode: "BW" | "COLOR";
    paperSize: "A4" | "A3";
    unitPricePaise: number;
    totalPaise: number;
  }>;
  items: Array<{
    description: string;
    quantity: number;
    unitPricePaise: number;
    totalPricePaise: number;
  }>;
  rejection: {
    rejectedAt: string | null;
    reason: string | null;
    category: string | null;
  };
  lifecycle: {
    submittedAt: string | null;
    acceptedAt: string | null;
    acceptedByUserId: string | null;
    readyAt: string | null;
    completedAt: string | null;
    completedByUserId: string | null;
  };
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedByType: string;
    changedByUserId: string | null;
    reason: string | null;
    changedAt: string | null;
  }>;
  print: {
    originalFilename: string;
    contentType: string;
    colorMode: "BW" | "COLOR";
    orientation: "PORTRAIT";
    copies: 1;
  } | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function ordersCollection(shopId: string) {
  return getFirebaseFirestore().collection(`shops/${shopId}/orders`);
}

function timestampToIso(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as Timestamp).toDate().toISOString();
  }

  return typeof value === "string" ? value : null;
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

function parsePrint(value: unknown): OrderDto["print"] {
  if (!value || typeof value !== "object") {
    return null;
  }

  const print = value as Record<string, unknown>;
  if (print.orientation !== "PORTRAIT" || print.copies !== 1) {
    return null;
  }

  if (print.colorMode !== "BW" && print.colorMode !== "COLOR") {
    return null;
  }

  if (typeof print.originalFilename !== "string" || typeof print.contentType !== "string") {
    return null;
  }

  return {
    originalFilename: print.originalFilename,
    contentType: print.contentType,
    colorMode: print.colorMode,
    orientation: "PORTRAIT",
    copies: 1,
  };
}

function printJobPath(shopId: string, orderId: string) {
  return path.join(process.cwd(), "data", "print-jobs", shopId, orderId);
}

function toOrderDto(
  snapshot: { id: string; data: () => Record<string, unknown> | undefined },
  history: OrderDto["statusHistory"] = [],
): OrderDto {
  const data = snapshot.data() ?? {};
  const amounts =
    data.amounts && typeof data.amounts === "object"
      ? (data.amounts as Record<string, unknown>)
      : {};
  const payment =
    data.payment && typeof data.payment === "object"
      ? (data.payment as Record<string, unknown>)
      : {};
  const rejection =
    data.rejection && typeof data.rejection === "object"
      ? (data.rejection as Record<string, unknown>)
      : {};
  const lifecycle =
    data.lifecycle && typeof data.lifecycle === "object"
      ? (data.lifecycle as Record<string, unknown>)
      : {};

  return {
    id: snapshot.id,
    orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : "",
    shopId: typeof data.shopId === "string" ? data.shopId : "",
    printUserId: typeof data.printUserId === "string" ? data.printUserId : "",
    customerPhone: textOrNull(data.customerPhone),
    status: (typeof data.status === "string" ? data.status : "SUBMITTED") as OrderStatus,
    pickupCode: typeof data.pickupCode === "string" ? data.pickupCode : "",
    amounts: {
      subtotalMinorUnits: integer(amounts.subtotalMinorUnits),
      taxMinorUnits: integer(amounts.taxMinorUnits),
      totalMinorUnits: integer(amounts.totalMinorUnits),
    },
    payment: {
      method: payment.method === "ONLINE" ? "ONLINE" : "CASH",
      status: payment.status === "PAID" ? "PAID" : "PENDING",
    },
    documents: Array.isArray(data.documents) ? (data.documents as OrderDto["documents"]) : [],
    items: Array.isArray(data.items) ? (data.items as OrderDto["items"]) : [],
    rejection: {
      rejectedAt: timestampToIso(rejection.rejectedAt),
      reason: textOrNull(rejection.reason),
      category: textOrNull(rejection.category),
    },
    lifecycle: {
      submittedAt: timestampToIso(lifecycle.submittedAt),
      acceptedAt: timestampToIso(lifecycle.acceptedAt),
      acceptedByUserId: textOrNull(lifecycle.acceptedByUserId),
      readyAt: timestampToIso(lifecycle.readyAt),
      completedAt: timestampToIso(lifecycle.completedAt),
      completedByUserId: textOrNull(lifecycle.completedByUserId),
    },
    statusHistory: history,
    print: parsePrint(data.print),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function sortNewest(orders: OrderDto[]) {
  return [...orders].sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
}

async function readHistory(shopId: string, orderId: string) {
  const snapshot = await ordersCollection(shopId).doc(orderId).collection("statusHistory").get();

  return snapshot.docs
    .map((document) => {
      const data = document.data();
      return {
        id: document.id,
        fromStatus: textOrNull(data.fromStatus),
        toStatus: typeof data.toStatus === "string" ? data.toStatus : "",
        changedByType: typeof data.changedByType === "string" ? data.changedByType : "SYSTEM",
        changedByUserId: textOrNull(data.changedByUserId),
        reason: textOrNull(data.reason),
        changedAt: timestampToIso(data.changedAt),
      };
    })
    .sort((left, right) => (left.changedAt ?? "").localeCompare(right.changedAt ?? ""));
}

export async function listShopOrders(user: AuthSessionUser) {
  const snapshot = await ordersCollection(user.shopId).get();
  return { orders: sortNewest(snapshot.docs.map((document) => toOrderDto(document))) };
}

export async function getShopOrder(user: AuthSessionUser, orderId: string) {
  const snapshot = await ordersCollection(user.shopId).doc(orderId).get();

  if (!snapshot.exists) {
    throw new AuthServiceError(404, "ORDER_NOT_FOUND");
  }

  return toOrderDto(snapshot, await readHistory(user.shopId, orderId));
}

export async function createShopOrder(user: AuthSessionUser, input: CheckoutOrderRequestInput) {
  const config = await getShopConfig(user);
  const documents = input.documents.map((document) => {
    const quote = quoteDocumentPrint(config, {
      billablePages: document.pageCount,
      copies: document.copies,
      colorMode: document.colorMode,
      paperSize: document.paperSize,
    });
    const id = randomUUID();
    const description = `${document.paperSize} ${document.colorMode === "BW" ? "B&W" : "Color"} (${document.pageCount} pages × ${document.copies} ${document.copies === 1 ? "copy" : "copies"})`;

    return {
      document: {
        id,
        originalFilename: document.originalFilename,
        pageCount: document.pageCount,
        copies: document.copies,
        colorMode: document.colorMode,
        paperSize: document.paperSize,
        unitPricePaise: quote.unitPricePaise,
        totalPaise: quote.totalPaise,
        config: {
          colorMode: document.colorMode,
          copies: document.copies,
          paperSize: document.paperSize,
          pageSelection: "all",
          inputTray: null,
        },
      },
      item: {
        description,
        quantity: document.pageCount * document.copies,
        unitPricePaise: quote.unitPricePaise,
        totalPricePaise: quote.totalPaise,
      },
    };
  });
  const subtotalMinorUnits = documents.reduce((sum, line) => sum + line.item.totalPricePaise, 0);
  const db = getFirebaseFirestore();
  const shopRef = db.doc(`shops/${user.shopId}`);
  const orderId = randomUUID();
  const historyId = randomUUID();
  const orderRef = ordersCollection(user.shopId).doc(orderId);
  const historyRef = orderRef.collection("statusHistory").doc(historyId);
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (transaction) => {
    const shop = await transaction.get(shopRef);

    if (!shop.exists) {
      throw new AuthServiceError(404, "shop not found");
    }

    const currentSequence = shop.get("orderSequence");
    const sequence =
      typeof currentSequence === "number" && Number.isInteger(currentSequence)
        ? currentSequence + 1
        : FIRST_ORDER_SEQUENCE + 1;
    const orderNumber = `ORD-${sequence}`;
    const pickupCode = String(sequence % 10_000).padStart(4, "0");

    transaction.update(shopRef, {
      orderSequence: sequence,
      updatedAt: now,
    });
    transaction.set(orderRef, {
      id: orderId,
      orderNumber,
      shopId: user.shopId,
      printUserId: input.printUserId ?? `guest-${randomUUID()}`,
      customerPhone: input.customerPhone ?? null,
      status: "SUBMITTED",
      pickupCode,
      amounts: {
        subtotalMinorUnits,
        taxMinorUnits: 0,
        totalMinorUnits: subtotalMinorUnits,
      },
      payment: {
        method: input.paymentMethod,
        status: "PENDING",
      },
      documents: documents.map((line) => line.document),
      items: documents.map((line) => line.item),
      rejection: {
        rejectedAt: null,
        reason: null,
        category: null,
      },
      lifecycle: {
        submittedAt: now,
        acceptedAt: null,
        acceptedByUserId: null,
        readyAt: null,
        completedAt: null,
        completedByUserId: null,
      },
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(historyRef, {
      historyId,
      fromStatus: null,
      toStatus: "SUBMITTED",
      changedByType: "PRINT_USER",
      changedByUserId: null,
      reason: null,
      changedAt: now,
    });
  });

  return getShopOrder(user, orderId);
}

async function transitionOrder(
  user: AuthSessionUser,
  orderId: string,
  action: TransitionAction,
  input: OrderTransitionRequestInput,
  requiredFrom: OrderStatus,
  next: OrderStatus,
  extra: Record<string, unknown>,
  history: { changedByType: "SHOP_USER" | "PRINT_USER"; reason: string | null },
) {
  const db = getFirebaseFirestore();
  const orderRef = ordersCollection(user.shopId).doc(orderId);
  const keyRef = db.doc(`shops/${user.shopId}/idempotencyKeys/${input.idempotencyKey}`);
  const historyRef = orderRef.collection("statusHistory").doc(randomUUID());
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (transaction) => {
    const keySnap = await transaction.get(keyRef);
    const orderSnap = await transaction.get(orderRef);

    if (keySnap.exists) {
      const storedOrderId = keySnap.get("orderId");
      const storedAction = keySnap.get("action");

      if (storedOrderId === orderId && storedAction === action) {
        return;
      }

      throw new AuthServiceError(409, "ORDER_STATUS_CONFLICT");
    }

    if (!orderSnap.exists) {
      throw new AuthServiceError(404, "ORDER_NOT_FOUND");
    }

    const current = String(orderSnap.get("status") ?? "");

    if (current !== requiredFrom || current !== input.currentStatus) {
      throw new AuthServiceError(
        409,
        current === "CANCELLED" ? "ORDER_ALREADY_CANCELLED" : "ORDER_STATUS_CONFLICT",
      );
    }

    const paymentMethod = orderSnap.get("payment.method");
    transaction.update(orderRef, {
      status: next,
      ...extra,
      ...(action === "complete" && paymentMethod === "CASH" ? { "payment.status": "PAID" } : {}),
      updatedAt: now,
    });
    transaction.set(historyRef, {
      historyId: historyRef.id,
      fromStatus: current,
      toStatus: next,
      changedByType: history.changedByType,
      changedByUserId: history.changedByType === "SHOP_USER" ? user.id : null,
      reason: history.reason,
      changedAt: now,
    });
    transaction.set(keyRef, {
      orderId,
      action,
      createdAt: now,
    });
  });

  return getShopOrder(user, orderId);
}

export function acceptShopOrder(
  user: AuthSessionUser,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  const now = FieldValue.serverTimestamp();
  return transitionOrder(user, orderId, "accept", input, "SUBMITTED", "SHOP_ACCEPTED", {
    "lifecycle.acceptedAt": now,
    "lifecycle.acceptedByUserId": user.id,
  }, { changedByType: "SHOP_USER", reason: null });
}

export function rejectShopOrder(
  user: AuthSessionUser,
  orderId: string,
  input: RejectOrderRequestInput,
) {
  return transitionOrder(user, orderId, "reject", input, "SUBMITTED", "REJECTED", {
    "rejection.rejectedAt": FieldValue.serverTimestamp(),
    "rejection.reason": input.reason,
    "rejection.category": input.category,
  }, { changedByType: "SHOP_USER", reason: input.reason });
}

export function markShopOrderPrinting(
  user: AuthSessionUser,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  return transitionOrder(
    user,
    orderId,
    "printing",
    input,
    "SHOP_ACCEPTED",
    "PRINTING",
    {},
    { changedByType: "SHOP_USER", reason: null },
  );
}

export function markShopOrderReady(
  user: AuthSessionUser,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  return transitionOrder(user, orderId, "ready", input, "PRINTING", "READY", {
    "lifecycle.readyAt": FieldValue.serverTimestamp(),
  }, { changedByType: "SHOP_USER", reason: null });
}

export function completeShopOrder(
  user: AuthSessionUser,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  return transitionOrder(user, orderId, "complete", input, "READY", "COMPLETED", {
    "lifecycle.completedAt": FieldValue.serverTimestamp(),
    "lifecycle.completedByUserId": user.id,
  }, { changedByType: "SHOP_USER", reason: null });
}

export function cancelShopOrder(
  user: AuthSessionUser,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  return transitionOrder(
    user,
    orderId,
    "cancel",
    input,
    "SUBMITTED",
    "CANCELLED",
    {},
    { changedByType: "PRINT_USER", reason: "Cancelled by customer" },
  );
}

export async function createSinglePagePrintOrder(
  user: AuthSessionUser,
  input: {
    filename: string;
    contentType: string;
    colorMode: "BW" | "COLOR";
    bytes: Buffer;
  },
) {
  const order = await createShopOrder(user, {
    paymentMethod: "CASH",
    customerPhone: "+919800011122",
    documents: [
      {
        originalFilename: input.filename,
        pageCount: 1,
        copies: 1,
        colorMode: input.colorMode,
        paperSize: "A4",
      },
    ],
  });
  const stored = printJobPath(user.shopId, order.id);
  await mkdir(path.dirname(stored), { recursive: true });
  await writeFile(stored, input.bytes);
  await ordersCollection(user.shopId).doc(order.id).set(
    {
      print: {
        originalFilename: input.filename,
        contentType: input.contentType,
        colorMode: input.colorMode,
        orientation: "PORTRAIT",
        copies: 1,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return getShopOrder(user, order.id);
}

export async function readSinglePagePrintFile(user: AuthSessionUser, orderId: string) {
  const order = await getShopOrder(user, orderId);

  if (!order.print) {
    throw new AuthServiceError(404, "this order has no print file");
  }

  const bytes = await readFile(printJobPath(user.shopId, orderId));
  return {
    bytes,
    contentType: order.print.contentType,
    filename: order.print.originalFilename,
  };
}

export function subscribeShopOrders(
  shopId: string,
  handlers: {
    onSnapshot: (orders: OrderDto[]) => void;
    onCreated: (order: OrderDto) => void;
    onChanged: (order: OrderDto) => void;
    onJobChanged: (job: Record<string, unknown>) => void;
    onError: (error: Error) => void;
  },
) {
  let seeded = false;
  let jobsSeeded = false;

  const unsubscribeOrders = ordersCollection(shopId).onSnapshot(
    (snapshot) => {
      if (!seeded) {
        seeded = true;
        handlers.onSnapshot(sortNewest(snapshot.docs.map((document) => toOrderDto(document))));
        return;
      }

      for (const change of snapshot.docChanges()) {
        const order = toOrderDto(change.doc);
        if (change.type === "added") {
          handlers.onCreated(order);
        } else if (change.type === "modified") {
          handlers.onChanged(order);
        }
      }
    },
    (error) => handlers.onError(error),
  );

  const unsubscribeJobs = getFirebaseFirestore()
    .collectionGroup("printJobs")
    .where("shopId", "==", shopId)
    .onSnapshot(
      (snapshot) => {
        if (!jobsSeeded) {
          jobsSeeded = true;
          return;
        }
        for (const change of snapshot.docChanges()) {
          if (change.type !== "removed") {
            handlers.onJobChanged({ id: change.doc.id, ...change.doc.data() });
          }
        }
      },
      (error) => handlers.onError(error),
    );

  return () => {
    unsubscribeOrders();
    unsubscribeJobs();
  };
}
