// Pure parts of the doorbell ring (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 4.8, 6.9). No Firebase
// imports, so they can be unit-tested directly.

export type RingEvent = "order_submitted" | "order_paid" | "jobs_queued" | "order_updated";

export type Ring = {
  /** True when agents should `sync`: a paid order to accept, or jobs queued. */
  work: boolean;
  event: RingEvent;
  orderId: string;
  orderNumber: string;
};

/** The doorbell's `last` keeps the event an operator most needs to hear about. */
const PRIORITY: Record<RingEvent, number> = {
  order_paid: 4,
  order_submitted: 3,
  jobs_queued: 2,
  order_updated: 1,
};

/** Two rings for the same shop in one request become one write. */
export function mergeRings(first: Ring, second: Ring): Ring {
  const top = PRIORITY[second.event] > PRIORITY[first.event] ? second : first;
  return { ...top, work: first.work || second.work };
}

/** The PATCH body. Timestamps are the database's own (`.sv`), never the server's clock. */
export function ringBody(ring: Ring) {
  return {
    boardAt: { ".sv": "timestamp" },
    ...(ring.work ? { workAt: { ".sv": "timestamp" } } : {}),
    last: { type: ring.event, orderId: ring.orderId, orderNumber: ring.orderNumber },
  };
}

/** `/doorbell/{shopId}.json` on the database, keeping query parameters such as the emulator's `ns`. */
export function doorbellUrl(databaseUrl: string, shopId: string) {
  const url = new URL(databaseUrl);
  url.pathname = `/doorbell/${encodeURIComponent(shopId)}.json`;
  return url.toString();
}

/** The Realtime Database emulator accepts `Bearer owner` instead of a Google access token. */
export function isEmulatorUrl(databaseUrl: string) {
  const host = new URL(databaseUrl).hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}

/**
 * A timed-out PATCH may still have been applied (the spike saw this), so it's "unknown", not
 * "failed". Anything else that throws, such as a refused connection, is a failure.
 */
export function classifyRingError(error: unknown): "unknown" | "failed" {
  const name = error instanceof Error ? error.name : "";
  return name === "TimeoutError" || name === "AbortError" ? "unknown" : "failed";
}
