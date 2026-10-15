// retryPrintJob against the Firestore emulator: retry, re-route and rescue.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { reportAgentJobs, syncAgent } from "@/src/modules/printing/agent-sync.service";
import { retryPrintJob } from "@/src/modules/printing/print-job.service";

import {
  clearFirestore,
  millisOf,
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

const RETRY = { idempotencyKey: "retry-key-0001" };

let s3: FakeS3;
let shopId: string;

function retry(jobId: string, input: { idempotencyKey: string; printerId?: string } = RETRY) {
  return retryPrintJob(principalFor(shopId), "order-1", jobId, input);
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
  await seedAgent(shopId, "agent-1");
  await seedAgent(shopId, "agent-2");
  await seedPrinter(shopId, "printer-1", "agent-1");
  await seedPrinter(shopId, "printer-2", "agent-2", { name: "Back office", systemName: "\\\\PC2\\Back office" });
  await seedOrder(shopId, "order-1", { status: "PRINTING" });
});

describe("retryPrintJob", () => {
  it("re-queues a FAILED job and clears its lease and error", async () => {
    await seedJob(shopId, "order-1", "job-1", {
      status: "FAILED",
      leaseId: "lease-1",
      claimedAt: minutesAgo(3),
      completedAt: minutesAgo(2),
      pagesPrinted: 1,
      spoolerJobId: 7,
      errorCode: "PAPER_JAM",
      errorMessage: "Paper jam",
    });

    const dto = await retry("job-1");

    assert.equal(dto.status, "QUEUED");
    assert.equal(dto.retryCount, 1);
    assert.equal(dto.leaseId, null);
    assert.equal(dto.claimedAt, null);
    assert.equal(dto.completedAt, null);
    assert.equal(dto.pagesPrinted, 0);
    assert.equal(dto.spoolerJobId, null);
    assert.equal(dto.errorCode, null);
    assert.equal(dto.errorMessage, null);
    assert.equal(dto.printerId, "printer-1");
    assert.equal(dto.agentId, "agent-1");
  });

  it("re-routes a QUEUED job to another printer and its PC", async () => {
    await seedJob(shopId, "order-1", "job-1");

    const dto = await retry("job-1", { ...RETRY, printerId: "printer-2" });

    assert.equal(dto.status, "QUEUED");
    assert.equal(dto.printerId, "printer-2");
    assert.equal(dto.agentId, "agent-2");
    assert.equal(dto.printerName, "Back office");
    assert.equal(dto.printerSystemName, "\\\\PC2\\Back office");
    assert.equal(dto.retryCount, 1);
  });

  it("treats re-queuing a QUEUED job on the same printer as a replay", async () => {
    await seedJob(shopId, "order-1", "job-1");
    const seeded = await readJob(shopId, "order-1", "job-1");

    const dto = await retry("job-1", { ...RETRY, printerId: "printer-1" });

    assert.equal(dto.status, "QUEUED");
    assert.equal(dto.retryCount, 0);
    const job = await readJob(shopId, "order-1", "job-1");
    assert.equal(millisOf(job.updatedAt), millisOf(seeded.updatedAt));
  });

  it("refuses to rescue a DISPATCHING job before 15 minutes", async () => {
    await seedJob(shopId, "order-1", "job-1", { status: "DISPATCHING", leaseId: "lease-1", claimedAt: minutesAgo(14) });

    await assert.rejects(retry("job-1"), { status: 409, message: "PRINT_JOB_STILL_ACTIVE" });

    const job = await readJob(shopId, "order-1", "job-1");
    assert.equal(job.status, "DISPATCHING");
    assert.equal(job.leaseId, "lease-1");
  });

  it("rescues a DISPATCHING job after 15 minutes, so the old PC's report no longer counts", async () => {
    await seedJob(shopId, "order-1", "job-1", { status: "DISPATCHING", leaseId: "lease-1", claimedAt: minutesAgo(16) });

    const dto = await retry("job-1", { ...RETRY, printerId: "printer-2" });
    assert.equal(dto.status, "QUEUED");
    assert.equal(dto.leaseId, null);
    assert.equal(dto.claimedAt, null);
    assert.equal(dto.agentId, "agent-2");

    const late = await reportAgentJobs(principalFor(shopId), "agent-1", {
      reports: [{ orderId: "order-1", jobId: "job-1", leaseId: "lease-1", status: "COMPLETED" }],
    });
    assert.deepEqual(late.results, [{ jobId: "job-1", result: "lease_mismatch" }]);

    const sync = await syncAgent(principalFor(shopId), "agent-2", "https://api.emulator.test");
    assert.equal(sync.claimed.length, 1);
    assert.notEqual(sync.claimed[0].leaseId, "lease-1");
    assert.equal(sync.claimed[0].redelivered, false);
  });

  it("refuses finished jobs, unknown jobs and unusable printers", async () => {
    await seedJob(shopId, "order-1", "job-done", { status: "COMPLETED", leaseId: "lease-1" });
    await seedJob(shopId, "order-1", "job-failed", { status: "FAILED" });
    await seedPrinter(shopId, "printer-off", "agent-2", { enabled: false });

    await assert.rejects(retry("job-done"), { status: 409, message: "PRINT_JOB_STATUS_CONFLICT" });
    await assert.rejects(retry("job-missing"), { status: 404, message: "PRINT_JOB_NOT_FOUND" });
    await assert.rejects(retry("job-failed", { ...RETRY, printerId: "printer-off" }), { status: 409, message: "PRINTER_DISABLED" });
    await assert.rejects(retry("job-failed", { ...RETRY, printerId: "printer-gone" }), { status: 404 });
    assert.equal((await readJob(shopId, "order-1", "job-failed")).status, "FAILED");
  });
});
