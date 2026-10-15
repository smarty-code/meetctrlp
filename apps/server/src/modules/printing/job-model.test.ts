import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { STUCK_JOB_MS, allDocumentsDone, decideReport, decideRetry } from "./job-model.ts";

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
