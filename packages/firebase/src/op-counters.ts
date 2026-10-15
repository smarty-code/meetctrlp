import { Firestore, Query, Transaction, WriteBatch } from "firebase-admin/firestore";

export type FirestoreOp = "read" | "write" | "delete";

type Listener = (op: FirestoreOp, count: number) => void;

// Kept on globalThis: a bundler may load this module more than once per process, but the
// prototypes it wraps are shared, so the state must be too.
const state = ((globalThis as { __ctrlpFirestoreOps?: { listener?: Listener; installed: boolean } })
  .__ctrlpFirestoreOps ??= { installed: false });

/** Receives every counted Firestore operation. One listener; the server attributes ops to requests. */
export function onFirestoreOp(next: Listener) {
  state.listener = next;
}

function emit(op: FirestoreOp, count: number) {
  try {
    state.listener?.(op, count);
  } catch {
    // Counting must never break a request.
  }
}

function readsIn(result: unknown) {
  if (Array.isArray(result)) {
    return result.length;
  }
  // A query costs at least one read even when it matches nothing.
  if (result && typeof result === "object" && "size" in result) {
    return Math.max(1, Number((result as { size: number }).size));
  }
  return 1;
}

function wrap(prototype: object, name: string, count: (result: unknown) => void) {
  const target = prototype as Record<string, unknown>;
  const original = target[name];

  if (typeof original !== "function") {
    return;
  }

  target[name] = function (this: unknown, ...args: unknown[]) {
    const result = (original as (...callArgs: unknown[]) => unknown).apply(this, args);

    if (result instanceof Promise) {
      return result.then((value) => {
        count(value);
        return value;
      });
    }

    count(result);
    return result;
  };
}

/**
 * Counts reads, writes and deletes made through the Admin SDK by wrapping its prototypes once
 * (TRAFFIC_SCALING_V2 12.1). Transaction retries count again, which matches what Firestore bills.
 *
 * Only the lowest public layer is wrapped, so nothing counts twice: `DocumentReference.get` goes
 * through `Firestore.getAll`, and document and transaction writes go through a `WriteBatch`.
 */
export function installFirestoreOpCounters() {
  if (state.installed) {
    return;
  }
  state.installed = true;

  wrap(Firestore.prototype, "getAll", (result) => emit("read", readsIn(result)));
  wrap(Query.prototype, "get", (result) => emit("read", readsIn(result)));
  wrap(Transaction.prototype, "get", (result) => emit("read", readsIn(result)));
  wrap(Transaction.prototype, "getAll", (result) => emit("read", readsIn(result)));

  for (const name of ["set", "update", "create"]) {
    wrap(WriteBatch.prototype, name, () => emit("write", 1));
  }
  wrap(WriteBatch.prototype, "delete", () => emit("delete", 1));
}
