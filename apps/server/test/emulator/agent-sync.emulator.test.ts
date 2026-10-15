// syncAgent against the Firestore emulator: auto-accept, claiming, re-delivery, paging and links.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { syncAgent } from "@/src/modules/printing/agent-sync.service";

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
  seedPrinter,
  seedShop,
  startFakeS3,
  storedDocument,
  type FakeS3,
} from "./harness.ts";

const ORIGIN = "https://api.emulator.test";
const AGENT = "agent-1";

let s3: FakeS3;
let shopId: string;

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
});

describe("syncAgent: auto-accept", () => {
  it("accepts a paid online order, queues its job and claims it in the same sync", async () => {
    await seedOrder(shopId, "paid-online", { payment: { method: "ONLINE", status: "PAID" } });
    await seedOrder(shopId, "cash-pending", { payment: { method: "CASH", status: "PENDING" } });
    await seedOrder(shopId, "paid-cash", { payment: { method: "CASH", status: "PAID" } });

    const response = await syncAgent(principalFor(shopId), AGENT, ORIGIN);

    assert.deepEqual(response.accepted, ["paid-online"]);
    assert.equal(response.more, false);
    assert.equal(response.claimed.length, 1);
    const [claimed] = response.claimed;
    assert.equal(claimed.orderId, "paid-online");
    assert.equal(claimed.documentId, "doc-1");
    assert.equal(claimed.printerId, "printer-1");
    assert.equal(claimed.redelivered, false);
    assert.ok(claimed.download);

    const order = await readOrder(shopId, "paid-online");
    assert.equal(order.status, "PRINTING");
    assert.equal(order.lifecycle.acceptedByUserId, `agent:${AGENT}`);
    assert.ok(Number.isFinite(millisOf(order.lifecycle.acceptedAt)));
    assert.ok(Number.isFinite(millisOf(order.lifecycle.printingAt)));

    const job = await readJob(shopId, "paid-online", claimed.jobId);
    assert.equal(job.status, "DISPATCHING");
    assert.equal(job.leaseId, claimed.leaseId);
    assert.equal(job.agentId, AGENT);
    assert.ok(Number.isFinite(millisOf(job.claimedAt)));

    assert.equal((await readOrder(shopId, "cash-pending")).status, "SUBMITTED");
    assert.equal((await readOrder(shopId, "paid-cash")).status, "SUBMITTED");
  });

  it("leaves paid orders alone when the shop turned auto-accept off", async () => {
    await seedShop(shopId, { autoAcceptPaidOnline: false });
    await seedOrder(shopId, "paid-online", { payment: { method: "ONLINE", status: "PAID" } });

    const response = await syncAgent(principalFor(shopId), AGENT, ORIGIN);

    assert.deepEqual(response.accepted, []);
    assert.deepEqual(response.claimed, []);
    assert.equal((await readOrder(shopId, "paid-online")).status, "SUBMITTED");
    const jobs = await db().collection(`shops/${shopId}/orders/paid-online/printJobs`).get();
    assert.equal(jobs.size, 0);
  });

  it("accepts without queuing when auto-dispatch is off", async () => {
    await seedShop(shopId, { autoDispatchAcceptedOrders: false });
    await seedOrder(shopId, "paid-online", { payment: { method: "ONLINE", status: "PAID" } });

    const response = await syncAgent(principalFor(shopId), AGENT, ORIGIN);

    assert.deepEqual(response.accepted, ["paid-online"]);
    assert.deepEqual(response.claimed, []);
    assert.equal((await readOrder(shopId, "paid-online")).status, "SHOP_ACCEPTED");
  });
});

describe("syncAgent: claiming queued jobs", () => {
  it("claims only this agent's queued jobs, each with a new lease, and moves the order to PRINTING", async () => {
    await seedOrder(shopId, "order-1", {
      status: "SHOP_ACCEPTED",
      documents: [storedDocument(shopId, "order-1", "doc-1"), storedDocument(shopId, "order-1", "doc-2")],
    });
    await seedJob(shopId, "order-1", "job-1", { documentId: "doc-1", createdAt: minutesAgo(3) });
    await seedJob(shopId, "order-1", "job-2", { documentId: "doc-2", createdAt: minutesAgo(2) });
    await seedOrder(shopId, "order-2", { status: "SHOP_ACCEPTED" });
    await seedJob(shopId, "order-2", "job-other-agent", { agentId: "agent-2" });

    const response = await syncAgent(principalFor(shopId), AGENT, ORIGIN);

    assert.deepEqual(response.claimed.map((job) => job.jobId), ["job-1", "job-2"]);
    assert.equal(response.more, false);
    const leases = response.claimed.map((job) => job.leaseId);
    assert.equal(new Set(leases).size, 2);
    for (const claimed of response.claimed) {
      const job = await readJob(shopId, "order-1", claimed.jobId);
      assert.equal(job.status, "DISPATCHING");
      assert.equal(job.leaseId, claimed.leaseId);
      assert.ok(Number.isFinite(millisOf(job.claimedAt)));
      assert.equal(claimed.orderNumber, "ORD-order-1");
      assert.equal(claimed.pagesTotal, 2);
    }
    assert.equal((await readOrder(shopId, "order-1")).status, "PRINTING");

    const untouched = await readJob(shopId, "order-2", "job-other-agent");
    assert.equal(untouched.status, "QUEUED");
    assert.equal(untouched.leaseId, null);
    assert.equal((await readOrder(shopId, "order-2")).status, "SHOP_ACCEPTED");
  });

  it("does not claim the same job twice", async () => {
    await seedOrder(shopId, "order-1", { status: "SHOP_ACCEPTED" });
    await seedJob(shopId, "order-1", "job-1");

    const first = await syncAgent(principalFor(shopId), AGENT, ORIGIN);
    const second = await syncAgent(principalFor(shopId), AGENT, ORIGIN);

    assert.equal(first.claimed.length, 1);
    assert.deepEqual(second.claimed, []);
    assert.equal((await readJob(shopId, "order-1", "job-1")).leaseId, first.claimed[0].leaseId);
  });

  it("pages with `more` when more than 10 jobs are queued", async () => {
    const documents = Array.from({ length: 11 }, (_, index) => storedDocument(shopId, "order-1", `doc-${index + 1}`));
    await seedOrder(shopId, "order-1", { status: "SHOP_ACCEPTED", documents });
    for (let index = 0; index < 11; index += 1) {
      await seedJob(shopId, "order-1", `job-${String(index + 1).padStart(2, "0")}`, {
        documentId: `doc-${index + 1}`,
        createdAt: minutesAgo(60 - index),
      });
    }

    const first = await syncAgent(principalFor(shopId), AGENT, ORIGIN);
    assert.equal(first.claimed.length, 10);
    assert.equal(first.more, true);
    assert.deepEqual(
      first.claimed.map((job) => job.jobId),
      Array.from({ length: 10 }, (_, index) => `job-${String(index + 1).padStart(2, "0")}`),
    );

    const second = await syncAgent(principalFor(shopId), AGENT, ORIGIN);
    assert.deepEqual(second.claimed.map((job) => job.jobId), ["job-11"]);
    assert.equal(second.more, false);
  });
});

describe("syncAgent: re-delivery of stuck jobs", () => {
  it("hands back a job stuck in DISPATCHING for 15 minutes with the same lease", async () => {
    await seedOrder(shopId, "order-1", {
      status: "PRINTING",
      documents: [storedDocument(shopId, "order-1", "doc-1"), storedDocument(shopId, "order-1", "doc-2")],
    });
    await seedJob(shopId, "order-1", "job-stuck", { status: "DISPATCHING", leaseId: "lease-stuck", claimedAt: minutesAgo(16) });
    await seedJob(shopId, "order-1", "job-recent", {
      documentId: "doc-2",
      status: "DISPATCHING",
      leaseId: "lease-recent",
      claimedAt: minutesAgo(5),
    });
    await seedOrder(shopId, "order-2", { status: "PRINTING" });
    await seedJob(shopId, "order-2", "job-other-agent", {
      agentId: "agent-2",
      status: "DISPATCHING",
      leaseId: "lease-other",
      claimedAt: minutesAgo(30),
    });

    const response = await syncAgent(principalFor(shopId), AGENT, ORIGIN);

    assert.equal(response.claimed.length, 1);
    const [redelivered] = response.claimed;
    assert.equal(redelivered.jobId, "job-stuck");
    assert.equal(redelivered.leaseId, "lease-stuck");
    assert.equal(redelivered.redelivered, true);
    assert.ok(redelivered.download);
    assert.equal(response.more, false);

    const stuck = await readJob(shopId, "order-1", "job-stuck");
    assert.equal(stuck.status, "DISPATCHING");
    assert.equal(stuck.leaseId, "lease-stuck");
    // claimedAt is refreshed, so the job no longer looks rescuable.
    assert.ok(millisOf(stuck.claimedAt) > Date.now() - 60_000);

    assert.equal((await readJob(shopId, "order-1", "job-recent")).leaseId, "lease-recent");
    assert.equal((await readJob(shopId, "order-2", "job-other-agent")).leaseId, "lease-other");

    const again = await syncAgent(principalFor(shopId), AGENT, ORIGIN);
    assert.deepEqual(again.claimed, []);
  });
});

describe("syncAgent: download links", () => {
  it("returns 60-minute links for stored files and null for shredded ones", async () => {
    await seedOrder(shopId, "order-1", {
      status: "PRINTING",
      documents: [
        storedDocument(shopId, "order-1", "doc-s3", { originalFilename: "Report.pdf" }),
        storedDocument(shopId, "order-1", "doc-local", { storageBackend: "local", mimeType: "image/png", pageCount: 1 }),
        storedDocument(shopId, "order-1", "doc-shredded", { shreddedAt: new Date().toISOString() }),
      ],
    });
    await seedJob(shopId, "order-1", "job-s3", { documentId: "doc-s3", createdAt: minutesAgo(3) });
    await seedJob(shopId, "order-1", "job-local", { documentId: "doc-local", createdAt: minutesAgo(2) });
    await seedJob(shopId, "order-1", "job-shredded", { documentId: "doc-shredded", createdAt: minutesAgo(1) });

    const startedAt = Date.now();
    const response = await syncAgent(principalFor(shopId), AGENT, ORIGIN);
    const byJob = new Map(response.claimed.map((job) => [job.jobId, job]));
    assert.equal(byJob.size, 3);

    const s3Job = byJob.get("job-s3");
    assert.equal(s3Job?.documentName, "Report.pdf");
    assert.equal(s3Job?.download?.expiresIn, 3600);
    assert.equal(s3Job?.download?.sha256Hash, "sha-doc-s3");
    const s3Url = new URL(s3Job?.download?.url ?? "");
    assert.equal(s3Url.origin, process.env.S3_ENDPOINT);
    assert.equal(s3Url.pathname, `/emulator-tests/uploads/${shopId}/order-1/doc-s3.pdf`);
    assert.equal(s3Url.searchParams.get("X-Amz-Expires"), "3600");

    const localJob = byJob.get("job-local");
    assert.equal(localJob?.download?.expiresIn, 3600);
    assert.equal(localJob?.download?.mimeType, "image/png");
    assert.equal(localJob?.download?.pageCount, 1);
    const localUrl = new URL(localJob?.download?.url ?? "");
    assert.equal(localUrl.origin, ORIGIN);
    assert.equal(localUrl.pathname, `/api/v1/shops/${shopId}/orders/order-1/documents/doc-local/content`);
    const expiresAt = Number(localUrl.searchParams.get("exp"));
    assert.ok(expiresAt >= startedAt + 3600_000 && expiresAt <= Date.now() + 3600_000);
    assert.ok(localUrl.searchParams.get("sig"));

    assert.equal(byJob.get("job-shredded")?.download, null);
  });
});
