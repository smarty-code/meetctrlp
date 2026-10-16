// Pure board and history rules (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.4). No Firestore imports.

export const ACTIVE_ORDER_STATUSES = ["SUBMITTED", "SHOP_ACCEPTED", "PRINTING", "READY"] as const;
/** PRINTING is kept for jobs claimed before that job state was dropped. */
export const UNFINISHED_JOB_STATUSES = ["QUEUED", "DISPATCHING", "PRINTING", "FAILED"] as const;

/**
 * An online order placed but not yet paid. The shop can't act on it, so the board leaves it out
 * until the payment lands; the guest or the daily clean-up cancels it otherwise.
 */
export function isAwaitingOnlinePayment(order: { status: string; payment: { method: string; status: string } }) {
  return order.status === "SUBMITTED" && order.payment.method === "ONLINE" && order.payment.status !== "PAID";
}

/** A delta returns at most this many orders and jobs; more means "send the full board". */
export const DELTA_CAP = 200;

/** `updatedAt` overlap that covers clock skew between server instances. */
export const DELTA_OVERLAP_MS = 5000;

/** Shops are in India: Asia/Kolkata is UTC+05:30 all year, with no daylight saving. */
const SHOP_UTC_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC instant a shop-time calendar day (`YYYY-MM-DD`) starts. */
export function shopDayStart(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - SHOP_UTC_OFFSET_MS);
}

/** `[from 00:00, to + 1 day 00:00)` in shop time, so `to` includes its whole day. */
export function shopDateRange(from?: string, to?: string) {
  return {
    start: from ? shopDayStart(from) : undefined,
    end: to ? new Date(shopDayStart(to).getTime() + DAY_MS) : undefined,
  };
}

/** Where a delta starts: the client's cursor minus the overlap, or null when the cursor is unusable. */
export function deltaStart(since: string | undefined, nowMs: number) {
  if (!since) {
    return null;
  }
  const sinceMs = Date.parse(since);
  // A cursor from the future, or older than a day, is cheaper to answer with the full board.
  if (!Number.isFinite(sinceMs) || sinceMs > nowMs + DELTA_OVERLAP_MS || nowMs - sinceMs > DAY_MS) {
    return null;
  }
  return new Date(sinceMs - DELTA_OVERLAP_MS);
}
