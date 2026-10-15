import { AsyncLocalStorage } from "node:async_hooks";

import { onFirestoreOp } from "@ctrlp/firebase";

/**
 * Per-request state for work that must finish before the response is sent, such as doorbell rings
 * (Cloud Run takes CPU away once the response goes out).
 */
export type RequestContext = {
  route: string;
  /** Run, in order, after the handler and before the response. Each must not throw. */
  finishers: Set<() => Promise<void>>;
  /** Module-owned state, keyed by a symbol each module keeps private. */
  values: Map<symbol, unknown>;
  /** Per-request cost counters, logged when FIRESTORE_OP_COUNTERS=1 (TRAFFIC_SCALING_V2 12.1). */
  counters: { reads: number; writes: number; deletes: number; rings: number; ringFailures: number };
};

const storage = new AsyncLocalStorage<RequestContext>();
const countersEnabled = process.env.FIRESTORE_OP_COUNTERS === "1";
let coldStart = true;

if (countersEnabled) {
  onFirestoreOp((op, count) => {
    const counters = storage.getStore()?.counters;
    if (!counters) {
      return;
    }
    if (op === "read") counters.reads += count;
    else if (op === "write") counters.writes += count;
    else counters.deletes += count;
  });
}

export function currentRequestContext() {
  return storage.getStore();
}

export function requestRoute(request: Request) {
  return `${request.method} ${new URL(request.url).pathname}`;
}

/** Runs a route handler in a request context and awaits its finishers, even if it throws. */
export function runInRequestContext<T>(route: string, handler: () => Promise<T>): Promise<T> {
  const context: RequestContext = {
    route,
    finishers: new Set(),
    values: new Map(),
    counters: { reads: 0, writes: 0, deletes: 0, rings: 0, ringFailures: 0 },
  };
  const startedAt = Date.now();
  let result: T | undefined;

  return storage.run(context, async () => {
    try {
      result = await handler();
      return result;
    } finally {
      for (const finish of context.finishers) {
        try {
          await finish();
        } catch (error) {
          console.error("Request finisher failed", route, error);
        }
      }

      if (countersEnabled) {
        console.log(JSON.stringify({
          severity: "INFO",
          message: "request_ops",
          route,
          status: result instanceof Response ? result.status : null,
          ms: Date.now() - startedAt,
          ...context.counters,
          coldStart,
        }));
      }
      coldStart = false;
    }
  });
}
