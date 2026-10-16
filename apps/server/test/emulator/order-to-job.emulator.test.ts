// From the guest's cart to the print job against the Firestore emulator: the orientation and pages
// the customer chose reach the printer, a selection the printer can't read is refused at the cart,
// and a document that can't be queued is recorded on the order.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { queueIncomingOrder } from "@/src/modules/printing/print-job.service";
import {
  submitGuestOrder,
  updateGuestDocumentConfiguration,
} from "@/src/modules/print-user/print-user.service";
import type { GuestPrincipal } from "@/src/modules/print-user/print-user-cookie";

import {
  clearFirestore,
  db,
  newShopId,
  principalFor,
  readOrder,
  seedAgent,
  seedOrder,
  seedPrinter,
  seedShop,
  startFakeS3,
  storedDocument,
  type FakeS3,
} from "./harness.ts";

const GUEST_ID = "guest-1";

let s3: FakeS3;
let shopId: string;

function guest(): GuestPrincipal {
  return { id: GUEST_ID, shopId, expiresAt: Date.now() + 60 * 60 * 1000 };
}

async function seedCart(config: Record<string, unknown> = {}) {
  await db().doc(`printUsers/${GUEST_ID}`).set({
    id: GUEST_ID,
    shopId,
    shopSlug: "test-shop",
    ipAddress: "203.0.113.7",
    documents: [
      {
        id: "doc-a",
        originalFilename: "doc-a.pdf",
        mimeType: "application/pdf",
        fileSizeBytes: 2048,
        pageCount: 10,
        sha256Hash: "sha-doc-a",
        storageKey: `uploads/${shopId}/${GUEST_ID}/doc-a.pdf`,
        status: "READY",
        config: {
          colorMode: "BW",
          copies: 1,
          paperSize: "A4",
          pageSelection: "all",
          billablePages: 10,
          orientation: "PORTRAIT",
          ...config,
        },
        createdAt: new Date().toISOString(),
      },
    ],
    activeOrderId: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
}

async function jobsOf(orderId: string) {
  return (await db().collection(`shops/${shopId}/orders/${orderId}/printJobs`).get()).docs.map((job) => job.data());
}

function rejectsWith(status: number, message: RegExp) {
  return (error: unknown) => error instanceof AuthServiceError && error.status === status && message.test(error.message);
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
  await db().doc(`shops/${shopId}`).set(
    { pricing: { bwA4PricePaise: 200, colorA4PricePaise: 1000, colorA3PricePaise: 2000 } },
    { merge: true },
  );
  await seedAgent(shopId, "agent-1");
  await seedPrinter(shopId, "printer-1", "agent-1");
});

describe("cart to print job", () => {
  it("carries landscape and the chosen pages, in canonical form, to the job", async () => {
    await seedCart();
    const saved = await updateGuestDocumentConfiguration(guest(), "doc-a", {
      colorMode: "BW",
      copies: 2,
      paperSize: "A4",
      orientation: "LANDSCAPE",
      pageSelection: { mode: "selected", expression: " 5-8, 1 ,3" },
    });
    assert.equal(saved.config.pageSelection, "1,3,5-8");
    assert.equal(saved.config.billablePages, 6);

    const { order } = await submitGuestOrder(guest(), { paymentMethod: "CASH", idempotencyKey: "landscape-key-0001" });
    assert.ok(order);
    const ordered = (await readOrder(shopId, order.id)).documents[0];
    assert.equal(ordered.config.orientation, "LANDSCAPE");
    assert.equal(ordered.config.pageSelection, "1,3,5-8");
    assert.equal(ordered.config.billablePages, 6);
    assert.equal(order.amounts.totalMinorUnits, 6 * 2 * 200);

    await db().doc(`shops/${shopId}/orders/${order.id}`).update({ status: "SHOP_ACCEPTED" });
    const { failures } = await queueIncomingOrder(principalFor(shopId), order.id);

    assert.deepEqual(failures, []);
    const [job] = await jobsOf(order.id);
    assert.equal(job.resolvedSettings.orientation, "LANDSCAPE");
    assert.equal(job.resolvedSettings.pageSelection, "1,3,5-8");
    assert.equal(job.resolvedSettings.copies, 2);
    assert.equal(job.resolvedSettings.billablePageCount, 6);
    assert.equal(job.pagesTotal, 12);
  });

  it("refuses at the cart a selection outside the document", async () => {
    await seedCart();
    await assert.rejects(
      updateGuestDocumentConfiguration(guest(), "doc-a", {
        colorMode: "BW",
        copies: 1,
        paperSize: "A4",
        pageSelection: { mode: "selected", expression: "1,200" },
      }),
      rejectsWith(400, /use valid pages from 1 to 10/),
    );
  });

  it("refuses to order a selection saved before the grammar was strict", async () => {
    await seedCart({ pageSelection: "1,200", billablePages: 1 });
    await assert.rejects(
      submitGuestOrder(guest(), { paymentMethod: "CASH", idempotencyKey: "legacy-key-0001" }),
      rejectsWith(400, /^doc-a\.pdf: use valid pages from 1 to 10/),
    );
  });
});

describe("queueIncomingOrder: documents that could not be queued", () => {
  it("records them on the order and clears them once they are queued", async () => {
    await seedOrder(shopId, "order-1", {
      status: "SHOP_ACCEPTED",
      documents: [
        storedDocument(shopId, "order-1", "doc-1"),
        storedDocument(shopId, "order-1", "doc-2", {
          paperSize: "A3",
          colorMode: "COLOR",
          config: { colorMode: "COLOR", copies: 1, paperSize: "A3", pageSelection: "all" },
        }),
      ],
    });

    const first = await queueIncomingOrder(principalFor(shopId), "order-1");
    assert.deepEqual(first.failures.map((entry) => [entry.documentId, entry.code]), [["doc-2", "QUEUE_FAILED"]]);
    const recorded = (await readOrder(shopId, "order-1")).queueErrors;
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].documentId, "doc-2");
    assert.match(recorded[0].message, /no compatible online printer/);
    assert.equal((await jobsOf("order-1")).length, 1);

    await seedPrinter(shopId, "printer-a3", "agent-1", {
      capabilities: ["A4", "A3", "COLOR"],
      offered: { bw: true, color: true, a4: true, a3: true },
    });
    const second = await queueIncomingOrder(principalFor(shopId), "order-1");

    assert.deepEqual(second.failures, []);
    assert.deepEqual((await readOrder(shopId, "order-1")).queueErrors, []);
    assert.equal((await jobsOf("order-1")).length, 2);
  });
});
