// cancelPrintJob and the `revoked` leases of sync against the Firestore emulator: a job the shop
// cancels or rescues is dropped by the PC that held it, instead of printing anyway.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { reportAgentJobs, syncAgent } from "@/src/modules/printing/agent-sync.service";
import { cancelPrintJob, retryPrintJob } from "@/src/modules/printing/print-job.service";

import {
  clearFirestore,
  minutesAgo,
  newShopId,
  principalFor,
  readJob,
  seedAgent,
  seedJob,
  seedOrder,
  seedPrinter,
  seedShop,
  startFakeS3,
  type FakeS3,
} from "./harness.ts";

const AGENT = "agent-1";
const ORIGIN = "https://api.emulator.test";

let s3: FakeS3;
let shopId: string;

function cancel(jobId: string, reason?: string) {
  return cancelPrintJob(principalFor(shopId), "order-1", jobId, { reason });
}

function held(jobId: string, leaseId: string) {
  return { orderId: "order-1", jobId, leaseId };
}

before(async () => {
  s3 = await startFakeS3();
});

after(async () => {
  await s3.close();
});

beforeEach(async () => {
  await clearFirestore();
  shopId = newShopId();
  await seedShop(shopId);
  await seedAgent(shopId, AGENT);
  await seedPrinter(shopId, "printer-1", AGENT);
  await seedOrder(shopId, "order-1", { status: "PRINTING" });
});

describe("cancelPrintJob", () => {
  it("cancels a waiting or failed job and clears its lease; a repeat is a replay", async () => {
    await seedJob(shopId, "order-1", "job-queued", { status: "QUEUED" });
    await seedJob(shopId, "order-1", "job-failed", { status: "FAILED", leaseId: "lease-2" });

    const queued = await cancel("job-queued", "customer left");
    assert.equal(queued.status, "CANCELLED");
    assert.equal(queued.leaseId, null);
    assert.equal(queued.errorCode, "CANCELLED_BY_SHOP");
    assert.equal(queued.errorMessage, "customer left");
    assert.equal((await cancel("job-failed")).status, "CANCELLED");

    const before = await readJob(shopId, "order-1", "job-queued");
    assert.equal((await cancel("job-queued")).status, "CANCELLED");
    assert.deepEqual(await readJob(shopId, "order-1", "job-queued"), before);
  });

  it("leaves a job a live PC is handling, but cancels one whose PC went quiet", async () => {
    await seedJob(shopId, "order-1", "job-live", { status: "DISPATCHING", leaseId: "lease-1", claimedAt: minutesAgo(2) });
    await seedJob(shopId, "order-1", "job-stuck", { status: "DISPATCHING", leaseId: "lease-2", claimedAt: minutesAgo(16) });
    await seedJob(shopId, "order-1", "job-done", { status: "COMPLETED", leaseId: "lease-3" });

    await assert.rejects(cancel("job-live"), { status: 409, message: "PRINT_JOB_STILL_ACTIVE" });
    assert.equal((await cancel("job-stuck")).status, "CANCELLED");
    await assert.rejects(cancel("job-done"), { status: 409, message: "PRINT_JOB_STATUS_CONFLICT" });
    await assert.rejects(cancel("job-missing"), { status: 404, message: "PRINT_JOB_NOT_FOUND" });
    assert.equal((await readJob(shopId, "order-1", "job-live")).leaseId, "lease-1");
  });
});

describe("syncAgent: revoked leases", () => {
  it("tells the PC which held leases to drop, and claims a rescued job under a new lease", async () => {
    await seedJob(shopId, "order-1", "job-live", { status: "DISPATCHING", leaseId: "lease-live", claimedAt: minutesAgo(1) });
    await seedJob(shopId, "order-1", "job-cancelled", { status: "DISPATCHING", leaseId: "lease-c", claimedAt: minutesAgo(20) });
    await seedJob(shopId, "order-1", "job-rescued", { status: "DISPATCHING", leaseId: "lease-r", claimedAt: minutesAgo(20) });
    await seedJob(shopId, "order-1", "job-done", { status: "COMPLETED", leaseId: "lease-d" });
    await cancel("job-cancelled");
    await retryPrintJob(principalFor(shopId), "order-1", "job-rescued", { idempotencyKey: "rescue-key-0001" });

    const response = await syncAgent(principalFor(shopId), AGENT, ORIGIN, {
      held: [
        held("job-live", "lease-live"),
        held("job-cancelled", "lease-c"),
        held("job-rescued", "lease-r"),
        held("job-done", "lease-d"),
        held("job-gone", "lease-g"),
      ],
    });

    assert.deepEqual(
      response.revoked.map((entry) => [entry.jobId, entry.leaseId, entry.reason]).sort(),
      [
        ["job-cancelled", "lease-c", "CANCELLED"],
        ["job-done", "lease-d", "FINISHED"],
        ["job-gone", "lease-g", "NOT_FOUND"],
        ["job-rescued", "lease-r", "RESCUED"],
      ],
    );
    const reclaimed = response.claimed.find((job) => job.jobId === "job-rescued");
    assert.ok(reclaimed);
    assert.notEqual(reclaimed.leaseId, "lease-r");

    // The old lease's report no longer counts, so a print under it changes nothing.
    const late = await reportAgentJobs(principalFor(shopId), AGENT, {
      reports: [{ orderId: "order-1", jobId: "job-cancelled", leaseId: "lease-c", status: "COMPLETED" }],
    });
    assert.deepEqual(late.results, [{ jobId: "job-cancelled", result: "lease_mismatch" }]);
  });

  it("revokes nothing for an agent that holds nothing, or one that still owns its leases", async () => {
    await seedJob(shopId, "order-1", "job-live", { status: "DISPATCHING", leaseId: "lease-live", claimedAt: minutesAgo(1) });

    assert.deepEqual((await syncAgent(principalFor(shopId), AGENT, ORIGIN)).revoked, []);
    assert.deepEqual(
      (await syncAgent(principalFor(shopId), AGENT, ORIGIN, { held: [held("job-live", "lease-live")] })).revoked,
      [],
    );
    // Another PC naming this lease is told it is not its job.
    await seedAgent(shopId, "agent-2");
    const other = await syncAgent(principalFor(shopId), "agent-2", ORIGIN, { held: [held("job-live", "lease-live")] });
    assert.deepEqual(other.revoked.map((entry) => entry.reason), ["RESCUED"]);
  });
});
