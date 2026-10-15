// Pure order rules shared by every order writer (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 4.1, 4.2).
// No Firestore imports, so they can be unit-tested directly.

export type OrderStatus =
  | "SUBMITTED"
  | "SHOP_ACCEPTED"
  | "PRINTING"
  | "READY"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

/** Who created the order. Only guest orders get a customer tracking copy. */
export type OrderChannel = "PRINT_USER" | "SHOP";

const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  SUBMITTED: ["SHOP_ACCEPTED", "REJECTED", "CANCELLED"],
  SHOP_ACCEPTED: ["PRINTING"],
  PRINTING: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

/** The `lifecycle.*At` field stamped when an order enters each status. */
export const LIFECYCLE_TIME_FIELD: Partial<Record<OrderStatus, string>> = {
  SHOP_ACCEPTED: "acceptedAt",
  PRINTING: "printingAt",
  READY: "readyAt",
  COMPLETED: "completedAt",
  REJECTED: "rejectedAt",
  CANCELLED: "cancelledAt",
};

export const EMPTY_LIFECYCLE = {
  submittedAt: null,
  paidAt: null,
  acceptedAt: null,
  acceptedByUserId: null,
  printingAt: null,
  readyAt: null,
  completedAt: null,
  completedByUserId: null,
  rejectedAt: null,
  cancelledAt: null,
} as const;

export function canTransition(from: string, to: OrderStatus) {
  return (NEXT_STATUSES[from as OrderStatus] ?? []).includes(to);
}

export function statusConflictReason(current: string) {
  return current === "CANCELLED" ? "ORDER_ALREADY_CANCELLED" : "ORDER_STATUS_CONFLICT";
}

/**
 * What a status-changing request does. A request for the status the order already has is a replay:
 * it succeeds with no write. That replaces the old per-request idempotency documents.
 */
export function decideTransition(input: {
  current: string;
  next: OrderStatus;
  requiredFrom: OrderStatus;
  /** The status the client believed the order had. */
  expected?: string;
}): { kind: "apply" } | { kind: "replay" } | { kind: "conflict"; reason: string } {
  if (input.current === input.next) {
    return { kind: "replay" };
  }

  if (input.current !== input.requiredFrom || (input.expected !== undefined && input.expected !== input.current)) {
    return { kind: "conflict", reason: statusConflictReason(input.current) };
  }

  return { kind: "apply" };
}

const MAX_SEARCH_KEYS = 40;

/**
 * Lowercased terms an operator can search for with `array-contains`: the order number (with and
 * without its prefix), the pickup code, the phone digits, and filename words of 3+ characters.
 */
export function buildSearchKeys(input: {
  orderNumber: string;
  pickupCode: string;
  customerPhone?: string | null;
  filenames: string[];
}) {
  const keys = new Set<string>();
  const add = (value: string | null | undefined) => {
    const key = value?.trim().toLowerCase();
    if (key && key.length >= 3) {
      keys.add(key);
    }
  };

  add(input.orderNumber);
  add(input.orderNumber.replace(/\D/g, ""));
  add(input.pickupCode);

  const phone = input.customerPhone?.replace(/\D/g, "") ?? "";
  add(phone);
  if (phone.length > 10) {
    add(phone.slice(-10));
  }

  for (const filename of input.filenames) {
    const base = filename.replace(/\.[^.]+$/, "");
    for (const word of base.split(/[^\p{L}\p{N}]+/u)) {
      add(word);
    }
  }

  return [...keys].slice(0, MAX_SEARCH_KEYS);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function orNull(value: unknown) {
  return value === undefined ? null : value;
}

/**
 * The customer-safe copy of a guest order (`orderTracking/{orderId}`). Rules can't hide fields, so
 * this copy leaves out staff IDs, payment references and storage keys. Values are copied as they
 * are, so server-timestamp sentinels in a pending write carry over. The caller adds `updatedAt`.
 */
export function trackingCopy(order: Record<string, unknown>) {
  const payment = record(order.payment);
  const amounts = record(order.amounts);
  const rejection = record(order.rejection);
  const lifecycle = record(order.lifecycle);
  const documents = Array.isArray(order.documents) ? order.documents.map(record) : [];

  return {
    orderId: orNull(order.id),
    shopId: orNull(order.shopId),
    printUserId: orNull(order.printUserId),
    orderNumber: orNull(order.orderNumber),
    pickupCode: orNull(order.pickupCode),
    status: orNull(order.status),
    payment: { method: orNull(payment.method), status: orNull(payment.status) },
    totalPaise: orNull(amounts.totalMinorUnits),
    items: documents.map((document) => {
      const config = record(document.config);
      return {
        name: orNull(document.originalFilename),
        pageCount: orNull(document.pageCount),
        billablePages: orNull(config.billablePages ?? document.pageCount),
        copies: orNull(document.copies),
        colorMode: orNull(document.colorMode),
        paperSize: orNull(document.paperSize),
        totalPaise: orNull(document.totalPaise),
        mimeType: orNull(document.mimeType),
      };
    }),
    rejectionReason: orNull(rejection.reason),
    times: {
      submittedAt: orNull(lifecycle.submittedAt),
      paidAt: orNull(lifecycle.paidAt),
      acceptedAt: orNull(lifecycle.acceptedAt),
      printingAt: orNull(lifecycle.printingAt),
      readyAt: orNull(lifecycle.readyAt),
      completedAt: orNull(lifecycle.completedAt),
      rejectedAt: orNull(lifecycle.rejectedAt),
      cancelledAt: orNull(lifecycle.cancelledAt),
    },
  };
}

const CUSTOMER_VISIBLE_PREFIXES = ["status", "payment.", "rejection.", "lifecycle.", "documents"];

/** Whether an update to the order changes anything in its tracking copy. */
export function touchesTrackingCopy(update: Record<string, unknown>) {
  return Object.keys(update).some((key) =>
    CUSTOMER_VISIBLE_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix)),
  );
}

/**
 * Applies a Firestore-style update with dotted field paths to a copy of the document data, so the
 * tracking copy can be built from the state the write will produce. The input isn't modified.
 */
export function applyDottedUpdate(data: Record<string, unknown>, update: Record<string, unknown>) {
  const result: Record<string, unknown> = { ...data };

  for (const [path, value] of Object.entries(update)) {
    const parts = path.split(".");
    let target = result;

    for (const part of parts.slice(0, -1)) {
      const next = { ...record(target[part]) };
      target[part] = next;
      target = next;
    }

    target[parts[parts.length - 1]] = value;
  }

  return result;
}
