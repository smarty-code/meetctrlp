import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { STUCK_JOB_MS, allDocumentsDone, decideCancel, decideReport, decideRetry, revokedReason } from "./job-model.ts";

describe("job reports", () => {
  const job = { status: "DISPATCHING", leaseId: "lease-1", agentId: "agent-1" };

  it("applies a report with the job's lease", () => {
    assert.deepEqual(decideReport(job, { status: "COMPLETED", leaseId: "lease-1" }, "agent-1"), { kind: "apply" });
  });

  it("treats a resent report as a replay", () => {
    assert.deepEqual(
      decideReport({ ...job, status: "COMPLETED" }, { status: "COMPLETED", leaseId: "lease-1" }, "agent-1"),
      { kind: "replay" },
    );
  });

  it("rejects a report from an old lease or another agent", () => {
    assert.deepEqual(decideReport(job, { status: "COMPLETED", leaseId: "lease-0" }, "agent-1"), { kind: "reject", result: "lease_mismatch" });
    assert.deepEqual(decideReport(job, { status: "COMPLETED", leaseId: "lease-1" }, "agent-2"), { kind: "reject", result: "lease_mismatch" });
    assert.deepEqual(
      decideReport({ ...job, status: "QUEUED", leaseId: null }, { status: "COMPLETED", leaseId: "lease-1" }, "agent-1"),
      { kind: "reject", result: "lease_mismatch" },
    );
  });

  it("rejects a different final status for a finished job", () => {
    assert.deepEqual(
      decideReport({ ...job, status: "COMPLETED" }, { status: "FAILED", leaseId: "lease-1" }, "agent-1"),
      { kind: "reject", result: "invalid_state" },
    );
  });
});

describe("order readiness", () => {
  const documents = [{ id: "d1" }, { docId: "d2", id: "x" }];

  it("is ready only when every document has completed", () => {
    assert.equal(allDocumentsDone(documents, [], "d1"), false);
    assert.equal(allDocumentsDone(documents, ["d1"], "d2"), true);
    assert.equal(allDocumentsDone(documents, ["d2", "d2"], "d1"), true, "duplicate completions are fine");
    assert.equal(allDocumentsDone([], [], "d1"), false);
  });
});

describe("job retry", () => {
  const now = 10 * STUCK_JOB_MS;

  it("allows FAILED and re-routing a QUEUED job", () => {
    assert.deepEqual(decideRetry({ status: "FAILED", claimedAtMs: 0, samePrinter: true, nowMs: now }), { kind: "apply" });
    assert.deepEqual(decideRetry({ status: "QUEUED", claimedAtMs: 0, samePrinter: false, nowMs: now }), { kind: "apply" });
  });

  it("treats re-queuing onto the same printer as a replay", () => {
    assert.deepEqual(decideRetry({ status: "QUEUED", claimedAtMs: 0, samePrinter: true, nowMs: now }), { kind: "replay" });
  });

  it("rescues DISPATCHING only after 15 minutes", () => {
    assert.deepEqual(
      decideRetry({ status: "DISPATCHING", claimedAtMs: now - STUCK_JOB_MS + 1000, samePrinter: true, nowMs: now }),
      { kind: "reject", reason: "PRINT_JOB_STILL_ACTIVE" },
    );
    assert.deepEqual(decideRetry({ status: "DISPATCHING", claimedAtMs: now - STUCK_JOB_MS, samePrinter: true, nowMs: now }), { kind: "apply" });
  });

  it("never retries a completed or cancelled job", () => {
    assert.deepEqual(decideRetry({ status: "COMPLETED", claimedAtMs: 0, samePrinter: true, nowMs: now }), { kind: "reject", reason: "PRINT_JOB_STATUS_CONFLICT" });
    assert.deepEqual(decideRetry({ status: "CANCELLED", claimedAtMs: 0, samePrinter: true, nowMs: now }), { kind: "reject", reason: "PRINT_JOB_STATUS_CONFLICT" });
  });
});

describe("job cancel", () => {
  const now = 10 * STUCK_JOB_MS;

  it("cancels waiting and failed jobs, and a claimed one only once its PC has gone quiet", () => {
    assert.deepEqual(decideCancel({ status: "QUEUED", claimedAtMs: 0, nowMs: now }), { kind: "apply" });
    assert.deepEqual(decideCancel({ status: "FAILED", claimedAtMs: 0, nowMs: now }), { kind: "apply" });
    assert.deepEqual(
      decideCancel({ status: "DISPATCHING", claimedAtMs: now - 1000, nowMs: now }),
      { kind: "reject", reason: "PRINT_JOB_STILL_ACTIVE" },
    );
    assert.deepEqual(decideCancel({ status: "DISPATCHING", claimedAtMs: now - STUCK_JOB_MS, nowMs: now }), { kind: "apply" });
  });

  it("treats a cancelled job as a replay and never cancels a completed one", () => {
    assert.deepEqual(decideCancel({ status: "CANCELLED", claimedAtMs: 0, nowMs: now }), { kind: "replay" });
    assert.deepEqual(decideCancel({ status: "COMPLETED", claimedAtMs: 0, nowMs: now }), { kind: "reject", reason: "PRINT_JOB_STATUS_CONFLICT" });
  });
});

describe("revoked leases", () => {
  const held = { leaseId: "lease-1" };
  const job = { exists: true, status: "DISPATCHING", leaseId: "lease-1", agentId: "agent-1" };

  it("keeps a lease the agent still owns", () => {
    assert.equal(revokedReason(job, held, "agent-1"), null);
  });

  it("revokes a lease whose job is gone, cancelled, finished or rescued", () => {
    assert.equal(revokedReason({ ...job, exists: false }, held, "agent-1"), "NOT_FOUND");
    assert.equal(revokedReason({ ...job, status: "CANCELLED", leaseId: null }, held, "agent-1"), "CANCELLED");
    assert.equal(revokedReason({ ...job, status: "COMPLETED" }, held, "agent-1"), "FINISHED");
    assert.equal(revokedReason({ ...job, status: "QUEUED", leaseId: null }, held, "agent-1"), "RESCUED");
    assert.equal(revokedReason({ ...job, leaseId: "lease-2" }, held, "agent-1"), "RESCUED");
    assert.equal(revokedReason({ ...job, agentId: "agent-2" }, held, "agent-1"), "RESCUED");
  });
});
