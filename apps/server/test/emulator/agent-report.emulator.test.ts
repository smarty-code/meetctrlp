// reportAgentJobs against the Firestore emulator: lease checks, READY, and shredding.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import type { AgentJobReportInput } from "@ctrlp/schemas";

import { reportAgentJobs } from "@/src/modules/printing/agent-sync.service";

import {
  clearFirestore,
  db,
  millisOf,
  minutesAgo,
  newShopId,
  principalFor,
  readJob,
  readOrder,
  seedAgent,
  seedJob,
  seedOrder,
  seedShop,
  startFakeS3,
  storedDocument,
  type FakeS3,
} from "./harness.ts";

const AGENT = "agent-1";

let s3: FakeS3;
let shopId: string;

function report(fields: Partial<AgentJobReportInput> = {}): AgentJobReportInput {
  return { orderId: "order-1", jobId: "job-1", leaseId: "lease-1", status: "COMPLETED", ...fields };
}

async function send(...reports: AgentJobReportInput[]) {
  const response = await reportAgentJobs(principalFor(shopId), AGENT, { reports });
  return response.results.map((entry) => entry.result);
}

function keyOf(docId: string, orderId = "order-1") {
  return `uploads/${shopId}/${orderId}/${docId}.pdf`;
}

/** An order being printed, with one claimed job per document. */
async function seedPrintingOrder(docIds: string[], fields: Record<string, unknown> = {}) {
  await seedOrder(shopId, "order-1", {
    status: "PRINTING",
    documents: docIds.map((docId) => storedDocument(shopId, "order-1", docId)),
    ...fields,
  });
  for (const [index, docId] of docIds.entries()) {
    await seedJob(shopId, "order-1", `job-${index + 1}`, {
      documentId: docId,
      status: "DISPATCHING",
      leaseId: `lease-${index + 1}`,
      claimedAt: minutesAgo(1),
    });
  }
}

before(async () => {
  s3 = await startFakeS3();
});

after(async () => {
  await s3.close();
});

beforeEach(async () => {
  await clearFirestore();
  s3.deleted.length = 0;
  s3.failing.clear();
  shopId = newShopId();
  await seedShop(shopId);
  await seedAgent(shopId, AGENT);
  await seedAgent(shopId, "agent-2");
});

describe("reportAgentJobs: completing jobs", () => {
  it("completes the job, marks the order READY and shreds the file", async () => {
    await seedPrintingOrder(["doc-1"]);

    assert.deepEqual(await send(report({ pagesPrinted: 5, spoolerJobId: 42 })), ["ok"]);

    const job = await readJob(shopId, "order-1", "job-1");
    assert.equal(job.status, "COMPLETED");
    assert.equal(job.pagesPrinted, 2, "pagesPrinted is capped at pagesTotal");
    assert.equal(job.spoolerJobId, 42);
    assert.ok(Number.isFinite(millisOf(job.completedAt)));

    const order = await readOrder(shopId, "order-1");
    assert.equal(order.status, "READY");
    assert.deepEqual(order.completedDocumentIds, ["doc-1"]);
    assert.ok(Number.isFinite(millisOf(order.lifecycle.readyAt)));
    assert.ok(order.documents[0].shreddedAt);
    assert.deepEqual(s3.deleted, [keyOf("doc-1")]);
  });

  it("waits for every document before READY", async () => {
    await seedPrintingOrder(["doc-1", "doc-2"]);

    assert.deepEqual(await send(report()), ["ok"]);
    let order = await readOrder(shopId, "order-1");
    assert.equal(order.status, "PRINTING");
    assert.deepEqual(order.completedDocumentIds, ["doc-1"]);

    assert.deepEqual(await send(report({ jobId: "job-2", leaseId: "lease-2" })), ["ok"]);
    order = await readOrder(shopId, "order-1");
    assert.equal(order.status, "READY");
    assert.deepEqual([...order.completedDocumentIds].sort(), ["doc-1", "doc-2"]);
    assert.deepEqual([...s3.deleted].sort(), [keyOf("doc-1"), keyOf("doc-2")]);
  });

  it("treats a resent report as a replay", async () => {
    await seedPrintingOrder(["doc-1"]);
    assert.deepEqual(await send(report()), ["ok"]);
    const completed = await readJob(shopId, "order-1", "job-1");

    assert.deepEqual(await send(report()), ["ok"]);

    const replayed = await readJob(shopId, "order-1", "job-1");
    assert.equal(millisOf(replayed.updatedAt), millisOf(completed.updatedAt));
    assert.deepEqual(s3.deleted, [keyOf("doc-1")], "an already shredded file is not deleted again");
  });

  it("updates a guest order's tracking copy when it becomes READY", async () => {
    await seedPrintingOrder(["doc-1"], { channel: "PRINT_USER", printUserId: "guest-1" });

    assert.deepEqual(await send(report()), ["ok"]);

    const tracking = (await db().doc("orderTracking/order-1").get()).data();
    assert.equal(tracking?.status, "READY");
    assert.equal(tracking?.printUserId, "guest-1");
  });

  it("records a failure without touching the order or the file", async () => {
    await seedPrintingOrder(["doc-1"]);

    assert.deepEqual(
      await send(report({ status: "FAILED", errorCode: "PAPER_JAM", errorMessage: "Paper jam in tray 1", pagesPrinted: 1 })),
      ["ok"],
    );

    const job = await readJob(shopId, "order-1", "job-1");
    assert.equal(job.status, "FAILED");
    assert.equal(job.errorCode, "PAPER_JAM");
    assert.equal(job.errorMessage, "Paper jam in tray 1");
    assert.equal(job.pagesPrinted, 1);
    const order = await readOrder(shopId, "order-1");
    assert.equal(order.status, "PRINTING");
    assert.equal(order.completedDocumentIds, undefined);
    assert.equal(order.documents[0].shreddedAt, null);
    assert.deepEqual(s3.deleted, []);
  });
});

describe("reportAgentJobs: rejected reports", () => {
  it("answers lease_mismatch for another lease or another agent", async () => {
    await seedPrintingOrder(["doc-1"]);

    assert.deepEqual(await send(report({ leaseId: "lease-old" })), ["lease_mismatch"]);
    const other = await reportAgentJobs(principalFor(shopId), "agent-2", { reports: [report()] });
    assert.deepEqual(other.results, [{ jobId: "job-1", result: "lease_mismatch" }]);

    assert.equal((await readJob(shopId, "order-1", "job-1")).status, "DISPATCHING");
    assert.equal((await readOrder(shopId, "order-1")).status, "PRINTING");
  });

  it("answers invalid_state for a different final status on a finished job", async () => {
    await seedPrintingOrder(["doc-1"]);
    assert.deepEqual(await send(report({ status: "FAILED", errorCode: "OFFLINE" })), ["ok"]);

    assert.deepEqual(await send(report({ status: "COMPLETED" })), ["invalid_state"]);
    assert.equal((await readJob(shopId, "order-1", "job-1")).status, "FAILED");
  });

  it("answers not_found for an unknown job or order", async () => {
    await seedPrintingOrder(["doc-1"]);

    assert.deepEqual(
      await send(report({ jobId: "job-missing" }), report({ orderId: "order-missing" })),
      ["not_found", "not_found"],
    );
  });

  it("gives each report in a batch its own result", async () => {
    await seedPrintingOrder(["doc-1", "doc-2"]);

    assert.deepEqual(
      await send(report(), report({ jobId: "job-2", leaseId: "lease-wrong" }), report({ jobId: "job-missing" })),
      ["ok", "lease_mismatch", "not_found"],
    );
    assert.equal((await readJob(shopId, "order-1", "job-1")).status, "COMPLETED");
    assert.equal((await readJob(shopId, "order-1", "job-2")).status, "DISPATCHING");
  });
});

describe("reportAgentJobs: shredding", () => {
  it("answers retry when the file can't be deleted, and shreds on the resend", async () => {
    await seedPrintingOrder(["doc-1"]);
    s3.failing.add(keyOf("doc-1"));

    assert.deepEqual(await send(report()), ["retry"]);
    assert.equal((await readJob(shopId, "order-1", "job-1")).status, "COMPLETED");
    let order = await readOrder(shopId, "order-1");
    assert.equal(order.status, "READY");
    assert.equal(order.documents[0].shreddedAt, null);

    s3.failing.clear();
    assert.deepEqual(await send(report()), ["ok"]);
    order = await readOrder(shopId, "order-1");
    assert.ok(order.documents[0].shreddedAt);
    assert.deepEqual(s3.deleted, [keyOf("doc-1")]);
  });

  it("keeps a file that another active job still prints", async () => {
    await seedPrintingOrder(["doc-1"]);
    await seedJob(shopId, "order-1", "job-reprint", { documentId: "doc-1", status: "QUEUED" });

    assert.deepEqual(await send(report()), ["ok"]);

    const order = await readOrder(shopId, "order-1");
    assert.equal(order.documents[0].shreddedAt, null);
    assert.deepEqual(s3.deleted, []);
  });

  it("shreds once the other job for the file has finished", async () => {
    await seedPrintingOrder(["doc-1"]);
    await seedJob(shopId, "order-1", "job-earlier", { documentId: "doc-1", status: "FAILED" });

    assert.deepEqual(await send(report()), ["ok"]);
    assert.deepEqual(s3.deleted, [keyOf("doc-1")]);
  });
});
