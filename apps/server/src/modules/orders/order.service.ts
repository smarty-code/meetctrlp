import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  FieldValue,
  getFirebaseFirestore,
  type DocumentReference,
  type Timestamp,
  type Transaction,
} from "@ctrlp/firebase/firestore";
import type {
  CheckoutOrderRequestInput,
  ConfirmOnlinePaymentRequestInput,
  OrderTransitionRequestInput,
  RecordCashPaymentRequestInput,
  RejectOrderRequestInput,
} from "@ctrlp/schemas";
import type { ShopPrincipal } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { systemPrincipal } from "@/src/modules/auth/principal";
import {
  EMPTY_LIFECYCLE,
  LIFECYCLE_TIME_FIELD,
  applyDottedUpdate,
  buildSearchKeys,
  canTransition,
  decideTransition,
  statusConflictReason,
  touchesTrackingCopy,
  trackingCopy,
  type OrderChannel,
  type OrderStatus,
} from "@/src/modules/orders/order-model";
import { ringShop } from "@/src/modules/realtime/doorbell";
import { getShopConfig, getShopConfigByShopId, incrementShopStats, quoteDocumentPrint } from "@/src/modules/shops/shop-config.service";

const FIRST_ORDER_SEQUENCE = 1041;


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
    amountPaise?: number;
    cashTenderedPaise?: number | null;
    changeReturnedPaise?: number | null;
    collectedByUserId?: string | null;
    collectedAt?: string | null;
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
    mimeType?: "application/pdf" | "image/jpeg" | "image/png";
    fileSizeBytes?: number;
    sha256Hash?: string;
    storageKey?: string;
    storageBackend?: "s3" | "local";
    shreddedAt?: string | null;
    config?: {
      colorMode: "BW" | "COLOR";
      copies: number;
      paperSize: "A4" | "A3";
      pageSelection: string;
      billablePages?: number;
      inputTray: null;
    };
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
    paidAt: string | null;
    acceptedAt: string | null;
    acceptedByUserId: string | null;
    printingAt: string | null;
    readyAt: string | null;
    completedAt: string | null;
    completedByUserId: string | null;
    rejectedAt: string | null;
    cancelledAt: string | null;
  };
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

function trackingRef(orderId: string) {
  return getFirebaseFirestore().doc(`orderTracking/${orderId}`);
}

type OrderChange = {
  /** The status to move to. Omit to change fields only. */
  status?: OrderStatus;
  /** Other fields to set, with dotted paths (for example `payment.status`). */
  fields?: Record<string, unknown>;
};

/**
 * The single writer for order status and customer-visible fields (TRAFFIC_SCALING_V2 4.1), inside the
 * caller's transaction. It checks the transition, stamps the matching `lifecycle.*At` and
 * `updatedAt` with the server time, skips no-op writes, and keeps a guest order's tracking copy in
 * step. `current` is the order data the transaction read.
 */
export function applyOrderChange(
  transaction: Transaction,
  orderRef: DocumentReference,
  current: Record<string, unknown>,
  change: OrderChange,
) {
  const from = String(current.status ?? "") as OrderStatus;
  const update: Record<string, unknown> = { ...change.fields };

  if (change.status && change.status !== from) {
    if (!canTransition(from, change.status)) {
      throw new AuthServiceError(409, statusConflictReason(from));
    }
    update.status = change.status;
    const timeField = LIFECYCLE_TIME_FIELD[change.status];
    if (timeField) {
      update[`lifecycle.${timeField}`] = FieldValue.serverTimestamp();
    }
  }

  if (Object.keys(update).length === 0) {
    return { changed: false, from, to: from };
  }

  update.updatedAt = FieldValue.serverTimestamp();
  transaction.update(orderRef, update);

  if (current.channel === "PRINT_USER" && touchesTrackingCopy(update)) {
    transaction.set(trackingRef(orderRef.id), {
      ...trackingCopy(applyDottedUpdate(current, update)),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return { changed: true, from, to: (update.status as OrderStatus | undefined) ?? from };
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

export function toOrderDto(snapshot: { id: string; data: () => Record<string, unknown> | undefined }): OrderDto {
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
      paidAt: timestampToIso(lifecycle.paidAt),
      acceptedAt: timestampToIso(lifecycle.acceptedAt),
      acceptedByUserId: textOrNull(lifecycle.acceptedByUserId),
      printingAt: timestampToIso(lifecycle.printingAt),
      readyAt: timestampToIso(lifecycle.readyAt),
      completedAt: timestampToIso(lifecycle.completedAt),
      completedByUserId: textOrNull(lifecycle.completedByUserId),
      rejectedAt: timestampToIso(lifecycle.rejectedAt),
      cancelledAt: timestampToIso(lifecycle.cancelledAt),
    },
    print: parsePrint(data.print),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function getShopOrder(user: ShopPrincipal, orderId: string) {
  const snapshot = await ordersCollection(user.shopId).doc(orderId).get();

  if (!snapshot.exists) {
    throw new AuthServiceError(404, "ORDER_NOT_FOUND");
  }

  return toOrderDto(snapshot);
}

export async function createShopOrder(user: ShopPrincipal, input: CheckoutOrderRequestInput) {
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
  const orderRef = ordersCollection(user.shopId).doc(orderId);
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
    const order = {
      id: orderId,
      orderNumber,
      shopId: user.shopId,
      channel: "SHOP" satisfies OrderChannel,
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
      lifecycle: { ...EMPTY_LIFECYCLE, submittedAt: now },
      completedDocumentIds: [],
      searchKeys: buildSearchKeys({
        orderNumber,
        pickupCode,
        customerPhone: input.customerPhone ?? null,
        filenames: documents.map((line) => line.document.originalFilename),
      }),
      createdAt: now,
      updatedAt: now,
    };
    transaction.set(orderRef, order);
  });

  const created = await getShopOrder(user, orderId);
  await ringShop(user.shopId, { work: false, event: "order_submitted", orderId, orderNumber: created.orderNumber });
  return created;
}

export async function getShopOrderById(shopId: string, orderId: string) {
  const snapshot = await ordersCollection(shopId).doc(orderId).get();

  if (!snapshot.exists) {
    throw new AuthServiceError(404, "ORDER_NOT_FOUND");
  }

  return toOrderDto(snapshot);
}

/** Returns the order a guest already placed with this idempotency key, if any. */
export async function findPrintUserOrderByIdempotencyKey(
  shopId: string,
  printUserId: string,
  idempotencyKey: string,
) {
  const keySnap = await getFirebaseFirestore()
    .doc(`shops/${shopId}/idempotencyKeys/${idempotencyKey}`)
    .get();
  const orderId = keySnap.get("orderId");
  if (!keySnap.exists || keySnap.get("action") !== "print-user-submit" || typeof orderId !== "string") {
    return null;
  }
  const order = await getShopOrderById(shopId, orderId);
  return order.printUserId === printUserId ? order : null;
}

export type PrintUserCheckoutDocument = {
  id: string;
  originalFilename: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  fileSizeBytes: number;
  pageCount: number;
  sha256Hash: string;
  storageKey: string;
  copies: number;
  colorMode: "BW" | "COLOR";
  paperSize: "A4" | "A3";
  pageSelection: string;
  billablePages: number;
};

export async function createPrintUserOrder(input: {
  shopId: string;
  printUserId: string;
  paymentMethod: "CASH" | "ONLINE";
  idempotencyKey: string;
  documents: PrintUserCheckoutDocument[];
}) {
  const config = await getShopConfigByShopId(input.shopId);
  const documents = input.documents.map((document) => {
    const quote = quoteDocumentPrint(config, {
      billablePages: document.billablePages,
      copies: document.copies,
      colorMode: document.colorMode,
      paperSize: document.paperSize,
    });
    const description = `${document.paperSize} ${document.colorMode === "BW" ? "B&W" : "Color"} (${document.billablePages} pages × ${document.copies} ${document.copies === 1 ? "copy" : "copies"})`;

    return {
      document: {
        id: document.id,
        originalFilename: document.originalFilename,
        pageCount: document.pageCount,
        copies: document.copies,
        colorMode: document.colorMode,
        paperSize: document.paperSize,
        unitPricePaise: quote.unitPricePaise,
        totalPaise: quote.totalPaise,
        mimeType: document.mimeType,
        fileSizeBytes: document.fileSizeBytes,
        sha256Hash: document.sha256Hash,
        storageKey: document.storageKey,
        storageBackend: "s3" as const,
        shreddedAt: null,
        status: "READY",
        config: {
          colorMode: document.colorMode,
          copies: document.copies,
          paperSize: document.paperSize,
          pageSelection: document.pageSelection,
          billablePages: document.billablePages,
          inputTray: null,
        },
      },
      item: {
        description,
        quantity: document.billablePages * document.copies,
        unitPricePaise: quote.unitPricePaise,
        totalPricePaise: quote.totalPaise,
      },
    };
  });
  const subtotalMinorUnits = documents.reduce((sum, line) => sum + line.item.totalPricePaise, 0);
  const db = getFirebaseFirestore();
  const shopRef = db.doc(`shops/${input.shopId}`);
  const keyRef = db.doc(`shops/${input.shopId}/idempotencyKeys/${input.idempotencyKey}`);
  const orderId = randomUUID();
  const orderRef = ordersCollection(input.shopId).doc(orderId);
  const now = FieldValue.serverTimestamp();
  let reusedOrderId: string | null = null;

  await db.runTransaction(async (transaction) => {
    const keySnap = await transaction.get(keyRef);
    if (keySnap.exists) {
      if (keySnap.get("action") === "print-user-submit" && typeof keySnap.get("orderId") === "string") {
        reusedOrderId = keySnap.get("orderId") as string;
        return;
      }
      throw new AuthServiceError(409, "IDEMPOTENCY_KEY_REUSED");
    }

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
    const order = {
      id: orderId,
      orderNumber,
      shopId: input.shopId,
      channel: "PRINT_USER" satisfies OrderChannel,
      printUserId: input.printUserId,
      customerPhone: null,
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
        amountPaise: subtotalMinorUnits,
      },
      documents: documents.map((line) => line.document),
      items: documents.map((line) => line.item),
      rejection: {
        rejectedAt: null,
        reason: null,
        category: null,
      },
      lifecycle: { ...EMPTY_LIFECYCLE, submittedAt: now },
      completedDocumentIds: [],
      searchKeys: buildSearchKeys({
        orderNumber,
        pickupCode,
        customerPhone: null,
        filenames: documents.map((line) => line.document.originalFilename),
      }),
      createdAt: now,
      updatedAt: now,
    };
    transaction.set(orderRef, order);
    transaction.set(trackingRef(orderId), { ...trackingCopy(order), updatedAt: now });
    transaction.set(keyRef, {
      orderId,
      action: "print-user-submit",
      createdAt: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });

  const order = await getShopOrderById(input.shopId, reusedOrderId ?? orderId);
  if (!reusedOrderId) {
    await ringShop(input.shopId, { work: false, event: "order_submitted", orderId, orderNumber: order.orderNumber });
  }
  return order;
}

/**
 * Moves an order from `requiredFrom` to `next`. A request for the status the order already has is a
 * replay: it returns the order with no write (`changed: false`).
 */
async function transitionOrder(
  user: ShopPrincipal,
  orderId: string,
  input: OrderTransitionRequestInput,
  requiredFrom: OrderStatus,
  next: OrderStatus,
  extra: Record<string, unknown> = {},
) {
  const db = getFirebaseFirestore();
  const orderRef = ordersCollection(user.shopId).doc(orderId);
  let changed = false;

  await db.runTransaction(async (transaction) => {
    changed = false;
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      throw new AuthServiceError(404, "ORDER_NOT_FOUND");
    }

    const current = orderSnap.data() ?? {};
    const decision = decideTransition({
      current: String(current.status ?? ""),
      next,
      requiredFrom,
      expected: input.currentStatus,
    });

    if (decision.kind === "replay") {
      return;
    }

    if (decision.kind === "conflict") {
      throw new AuthServiceError(409, decision.reason);
    }

    changed = applyOrderChange(transaction, orderRef, current, { status: next, fields: extra }).changed;
  });

  const order = await getShopOrder(user, orderId);
  if (changed) {
    await ringShop(user.shopId, { work: false, event: "order_updated", orderId, orderNumber: order.orderNumber });
  }
  return { order, changed };
}

/** Accepts the order. `accepted` is false when it was already accepted (a replay). */
export async function acceptShopOrder(
  user: ShopPrincipal,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  const { order, changed } = await transitionOrder(user, orderId, input, "SUBMITTED", "SHOP_ACCEPTED", {
    "lifecycle.acceptedByUserId": user.shopUserId,
  });
  return { order, accepted: changed };
}

export async function rejectShopOrder(
  user: ShopPrincipal,
  orderId: string,
  input: RejectOrderRequestInput,
) {
  const { order } = await transitionOrder(user, orderId, input, "SUBMITTED", "REJECTED", {
    "rejection.rejectedAt": FieldValue.serverTimestamp(),
    "rejection.reason": input.reason,
    "rejection.category": input.category,
  });
  return order;
}

export async function markShopOrderPrinting(
  user: ShopPrincipal,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  return (await transitionOrder(user, orderId, input, "SHOP_ACCEPTED", "PRINTING")).order;
}

export async function markShopOrderReady(
  user: ShopPrincipal,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  return (await transitionOrder(user, orderId, input, "PRINTING", "READY")).order;
}

export async function completeShopOrder(
  user: ShopPrincipal,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  const order = await getShopOrder(user, orderId);
  if (order.payment.method === "CASH" && order.payment.status !== "PAID") {
    throw new AuthServiceError(409, "CASH_PAYMENT_REQUIRED");
  }
  const { order: completed, changed } = await transitionOrder(user, orderId, input, "READY", "COMPLETED", {
    "lifecycle.completedByUserId": user.shopUserId,
  });
  if (changed) {
    await incrementShopStats(user.shopId, {
      totalOrdersToday: 1,
      grossRevenueTodayPaise: completed.amounts.totalMinorUnits,
    });
  }
  return completed;
}

/** Records cash for a READY order. Idempotent by state: an order already paid is returned as is. */
export async function recordCashPayment(
  user: ShopPrincipal,
  orderId: string,
  input: RecordCashPaymentRequestInput,
) {
  const db = getFirebaseFirestore();
  const orderRef = ordersCollection(user.shopId).doc(orderId);
  let applied = false;

  await db.runTransaction(async (transaction) => {
    applied = false;
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new AuthServiceError(404, "ORDER_NOT_FOUND");
    }
    const current = orderSnap.data() ?? {};
    if (orderSnap.get("payment.method") !== "CASH") {
      throw new AuthServiceError(409, "ORDER_NOT_CASH");
    }
    if (orderSnap.get("payment.status") === "PAID") {
      return;
    }
    if (current.status !== "READY") {
      throw new AuthServiceError(409, "ORDER_NOT_READY_FOR_COLLECTION");
    }
    const total = Number(orderSnap.get("amounts.totalMinorUnits") ?? 0);
    if (input.cashTenderedPaise < total) {
      throw new AuthServiceError(400, "CASH_TENDERED_TOO_LOW");
    }
    const now = FieldValue.serverTimestamp();
    applyOrderChange(transaction, orderRef, current, {
      fields: {
        "payment.status": "PAID",
        "payment.amountPaise": total,
        "payment.cashTenderedPaise": input.cashTenderedPaise,
        "payment.changeReturnedPaise": input.cashTenderedPaise - total,
        "payment.collectedByUserId": user.shopUserId,
        "payment.collectedAt": now,
        "lifecycle.paidAt": now,
      },
    });
    applied = true;
  });

  const paid = await getShopOrder(user, orderId);
  if (applied) {
    await incrementShopStats(user.shopId, { cashInDrawerTodayPaise: paid.amounts.totalMinorUnits });
    await ringShop(user.shopId, { work: false, event: "order_updated", orderId, orderNumber: paid.orderNumber });
  }
  return paid;
}

/**
 * Payment-provider callback entry point, separate from the shop operator APIs. Idempotent by state:
 * an order already paid is returned with no write.
 *
 * It doesn't accept the order: a running shop PC's `sync` does, so a paid order waits as SUBMITTED
 * while no PC is on, instead of being accepted into a queue nobody prints.
 */
export async function confirmOnlinePayment(
  shopId: string,
  orderId: string,
  input: ConfirmOnlinePaymentRequestInput,
) {
  const db = getFirebaseFirestore();
  const orderRef = ordersCollection(shopId).doc(orderId);
  const principal = systemPrincipal(shopId, "payment-provider");
  let applied = false;

  await db.runTransaction(async (transaction) => {
    applied = false;
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) throw new AuthServiceError(404, "ORDER_NOT_FOUND");
    if (orderSnap.get("payment.method") !== "ONLINE") throw new AuthServiceError(409, "ORDER_NOT_ONLINE");
    if (orderSnap.get("payment.status") === "PAID") return;

    const now = FieldValue.serverTimestamp();
    applyOrderChange(transaction, orderRef, orderSnap.data() ?? {}, {
      fields: {
        "payment.status": "PAID",
        "payment.reference": input.paymentReference,
        "payment.confirmedAt": now,
        "lifecycle.paidAt": now,
      },
    });
    applied = true;
  });

  const order = await getShopOrder(principal, orderId);
  if (applied) {
    // `work` wakes the shop's agents; their `sync` accepts the paid order.
    await ringShop(shopId, { work: true, event: "order_paid", orderId, orderNumber: order.orderNumber });
  }
  return { order };
}

export async function cancelShopOrder(
  user: ShopPrincipal,
  orderId: string,
  input: OrderTransitionRequestInput,
) {
  return (await transitionOrder(user, orderId, input, "SUBMITTED", "CANCELLED")).order;
}

export async function createSinglePagePrintOrder(
  user: ShopPrincipal,
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

export async function readSinglePagePrintFile(user: ShopPrincipal, orderId: string) {
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
