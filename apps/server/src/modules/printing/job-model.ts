// Pure job rules for sync, report and retry (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.3). No Firestore
// imports, so they can be unit-tested directly.

/** A DISPATCHING job older than this has a PC that stopped syncing. */
export const STUCK_JOB_MS = 15 * 60 * 1000;

export type ReportDecision =
  | { kind: "replay" }
  | { kind: "apply" }
  | { kind: "reject"; result: "lease_mismatch" | "invalid_state" };

/**
 * What a final report does to a job. The same status with the same lease is a replay (the outbox
 * resends after a lost response). Another lease means the job was retried or rescued since.
 */
export function decideReport(
  job: { status: string; leaseId: unknown; agentId: unknown },
  report: { status: string; leaseId: string },
  agentId: string,
): ReportDecision {
  const sameLease = job.leaseId === report.leaseId && job.agentId === agentId;
  if (sameLease && job.status === report.status) {
    return { kind: "replay" };
  }
  if (!sameLease) {
    return { kind: "reject", result: "lease_mismatch" };
  }
  // PRINTING is accepted for jobs claimed before the PRINTING state was dropped.
  if (job.status !== "DISPATCHING" && job.status !== "PRINTING") {
    return { kind: "reject", result: "invalid_state" };
  }
  return { kind: "apply" };
}

/** True when every document of the order has a completed job once `documentId` completes. */
export function allDocumentsDone(
  documents: Array<{ id?: unknown; docId?: unknown }>,
  completedDocumentIds: unknown,
  documentId: string,
) {
  const expected = documents
    .map((entry) => entry.docId ?? entry.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const done = new Set([...(Array.isArray(completedDocumentIds) ? (completedDocumentIds as string[]) : []), documentId]);
  return expected.length > 0 && expected.every((id) => done.has(id));
}

export type RetryDecision = { kind: "replay" } | { kind: "apply" } | { kind: "reject"; reason: string };

/**
 * Whether the operator may put a job back in the queue: from FAILED, from QUEUED to re-route it,
 * or from DISPATCHING once it has been stuck for 15 minutes. Re-queuing a queued job onto the same
 * printer is a replay.
 */
export function decideRetry(input: { status: string; claimedAtMs: number; samePrinter: boolean; nowMs: number }): RetryDecision {
  if (input.status === "QUEUED" && input.samePrinter) {
    return { kind: "replay" };
  }
  if (input.status === "FAILED" || input.status === "QUEUED") {
    return { kind: "apply" };
  }
  const active = input.status === "DISPATCHING" || input.status === "PRINTING";
  if (active && input.nowMs - input.claimedAtMs >= STUCK_JOB_MS) {
    return { kind: "apply" };
  }
  return { kind: "reject", reason: active ? "PRINT_JOB_STILL_ACTIVE" : "PRINT_JOB_STATUS_CONFLICT" };
}
