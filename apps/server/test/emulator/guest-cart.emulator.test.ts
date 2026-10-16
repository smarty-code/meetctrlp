// The guest cart against the Firestore emulator: checkout, delete and clear all, and the races
// between them. A document is always in the cart or in one order, and no order loses its file.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { confirmOnlinePayment } from "@/src/modules/orders/order.service";
import {
  cancelGuestOrder,
  clearGuestCart,
  deleteGuestDocument,
  submitGuestOrder,
} from "@/src/modules/print-user/print-user.service";
import type { GuestPrincipal } from "@/src/modules/print-user/print-user-cookie";

import { clearFirestore, db, minutesAgo, newShopId, readOrder, seedShop, startFakeS3, type FakeS3 } from "./harness.ts";

const GUEST_ID = "guest-1";
/** 2 pages × 1 copy at the seeded B&W rate. */
const DOCUMENT_PAISE = 400;

let s3: FakeS3;
let shopId: string;
let keySequence = 0;

function guest(id = GUEST_ID): GuestPrincipal {
  return { id, shopId, expiresAt: Date.now() + 60 * 60 * 1000 };
}

function storageKeyOf(docId: string, guestId = GUEST_ID) {
  return `uploads/${shopId}/${guestId}/${docId}.pdf`;
}

function cartDocument(docId: string, fields: Record<string, unknown> = {}, guestId = GUEST_ID) {
  return {
    id: docId,
    originalFilename: `${docId}.pdf`,
    mimeType: "application/pdf",
    fileSizeBytes: 2048,
    pageCount: 2,
    sha256Hash: `sha-${docId}`,
    storageKey: storageKeyOf(docId, guestId),
    status: "READY",
    config: { colorMode: "BW", copies: 1, paperSize: "A4", pageSelection: "all", billablePages: 2, orientation: "PORTRAIT" },
    createdAt: new Date().toISOString(),
    ...fields,
  };
}

async function seedGuest(documents: Array<Record<string, unknown>>, guestId = GUEST_ID) {
  await db().doc(`printUsers/${guestId}`).set({
    id: guestId,
    shopId,
    shopSlug: "test-shop",
    ipAddress: "203.0.113.7",
    documents,
    activeOrderId: null,
    createdAt: new Date(),
    lastSeenAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
}

async function readCart(guestId = GUEST_ID) {
  return (await db().doc(`printUsers/${guestId}`).get()).data() ?? {};
}

async function cartIds(guestId = GUEST_ID) {
  return ((await readCart(guestId)).documents as Array<{ id: string }>).map((entry) => entry.id);
}

async function orderIds() {
  return (await db().collection(`shops/${shopId}/orders`).get()).docs.map((order) => order.id);
}

function submit(
  input: { idempotencyKey?: string; expectedTotalPaise?: number; paymentMethod?: "CASH" | "ONLINE" } = {},
  principal = guest(),
) {
  keySequence += 1;
  return submitGuestOrder(principal, {
    paymentMethod: input.paymentMethod ?? "CASH",
    idempotencyKey: input.idempotencyKey ?? `submit-key-${keySequence.toString().padStart(4, "0")}`,
    expectedTotalPaise: input.expectedTotalPaise,
  });
}

function rejectsWith(status: number, message: string) {
  return (error: unknown) => error instanceof AuthServiceError && error.status === status && error.message === message;
}

/** Every order's files must still be in the bucket, whatever ran next to its checkout. */
async function assertNoOrderLostItsFile() {
  for (const orderId of await orderIds()) {
    const documents = (await readOrder(shopId, orderId)).documents as Array<{ storageKey: string }>;
    for (const document of documents) {
      assert.equal(s3.deleted.includes(document.storageKey), false, `order ${orderId} lost ${document.storageKey}`);
    }
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
  await db().doc(`shops/${shopId}`).set(
    { pricing: { bwA4PricePaise: 200, colorA4PricePaise: 1000, colorA3PricePaise: 2000 } },
    { merge: true },
  );
});

describe("submitGuestOrder", () => {
  it("moves the cart into one order in one step and keeps the files", async () => {
    await seedGuest([cartDocument("doc-a"), cartDocument("doc-b")]);

    const result = await submit({ expectedTotalPaise: 2 * DOCUMENT_PAISE });

    assert.equal(result.priceChanged, false);
    assert.ok(result.order);
    assert.equal(result.quote.totalPaise, 2 * DOCUMENT_PAISE);
    const order = await readOrder(shopId, result.order.id);
    assert.deepEqual(
      (order.documents as Array<{ id: string; storageKey: string }>).map((entry) => [entry.id, entry.storageKey]),
      [["doc-a", storageKeyOf("doc-a")], ["doc-b", storageKeyOf("doc-b")]],
    );
    assert.equal(order.amounts.totalMinorUnits, 2 * DOCUMENT_PAISE);
    const cart = await readCart();
    assert.deepEqual(cart.documents, []);
    assert.equal(cart.activeOrderId, result.order.id);
    assert.deepEqual(s3.deleted, []);
  });

  it("returns the same order for a retried key without placing another", async () => {
    await seedGuest([cartDocument("doc-a")]);

    const first = await submit({ idempotencyKey: "retried-key-0001" });
    const second = await submit({ idempotencyKey: "retried-key-0001" });

    assert.equal(second.order?.id, first.order?.id);
    assert.equal(second.quote.totalPaise, DOCUMENT_PAISE);
    assert.deepEqual(await orderIds(), [first.order?.id]);
  });

  it("refuses another guest's key", async () => {
    await seedGuest([cartDocument("doc-a")]);
    await seedGuest([cartDocument("doc-z", {}, "guest-2")], "guest-2");
    await submit({ idempotencyKey: "shared-key-0001" });

    await assert.rejects(
      submit({ idempotencyKey: "shared-key-0001" }, guest("guest-2")),
      rejectsWith(409, "IDEMPOTENCY_KEY_REUSED"),
    );
    assert.deepEqual(await cartIds("guest-2"), ["doc-z"]);
  });

  it("refuses while a document is still uploading, and changes nothing", async () => {
    await seedGuest([cartDocument("doc-a"), cartDocument("doc-up", { status: "UPLOADING", pageCount: null })]);

    await assert.rejects(submit(), rejectsWith(409, "DOCUMENTS_STILL_UPLOADING"));

    assert.deepEqual(await cartIds(), ["doc-a", "doc-up"]);
    assert.deepEqual(await orderIds(), []);
  });

  it("drops abandoned uploads at checkout and deletes their files", async () => {
    await seedGuest([
      cartDocument("doc-a"),
      cartDocument("doc-failed", { status: "FAILED" }),
      cartDocument("doc-stale", { status: "UPLOADING", pageCount: null, createdAt: minutesAgo(30).toISOString() }),
    ]);

    const result = await submit();

    assert.deepEqual(
      ((await readOrder(shopId, result.order?.id ?? "")).documents as Array<{ id: string }>).map((entry) => entry.id),
      ["doc-a"],
    );
    assert.deepEqual(await cartIds(), []);
    assert.deepEqual(s3.deleted.sort(), [storageKeyOf("doc-failed"), storageKeyOf("doc-stale")].sort());
  });

  it("returns the new quote on a price change, and changes nothing", async () => {
    await seedGuest([cartDocument("doc-a")]);

    const result = await submit({ expectedTotalPaise: 1 });

    assert.equal(result.priceChanged, true);
    assert.equal(result.order, null);
    assert.equal(result.quote.totalPaise, DOCUMENT_PAISE);
    assert.deepEqual(await cartIds(), ["doc-a"]);
    assert.deepEqual(await orderIds(), []);
  });

  it("refuses an empty cart", async () => {
    await seedGuest([]);
    await assert.rejects(submit(), rejectsWith(400, "upload at least one document"));
  });
});

describe("deleteGuestDocument", () => {
  it("removes the entry, then its file, and is idempotent", async () => {
    await seedGuest([cartDocument("doc-a"), cartDocument("doc-b")]);

    assert.deepEqual(await deleteGuestDocument(guest(), "doc-a"), { ok: true, removed: true });
    assert.deepEqual(await cartIds(), ["doc-b"]);
    assert.deepEqual(s3.deleted, [storageKeyOf("doc-a")]);

    assert.deepEqual(await deleteGuestDocument(guest(), "doc-a"), { ok: true, removed: false });
    assert.deepEqual(s3.deleted, [storageKeyOf("doc-a")]);
  });

  it("refuses a document that is in the guest's order and keeps its file", async () => {
    await seedGuest([cartDocument("doc-a")]);
    await submit();

    await assert.rejects(deleteGuestDocument(guest(), "doc-a"), rejectsWith(409, "ALREADY_ORDERED"));
    assert.deepEqual(s3.deleted, []);
  });
});

describe("clearGuestCart", () => {
  it("empties the cart, uploads in flight included, and deletes every file", async () => {
    await seedGuest([
      cartDocument("doc-a"),
      cartDocument("doc-b"),
      cartDocument("doc-up", { status: "UPLOADING", pageCount: null }),
    ]);

    assert.deepEqual(await clearGuestCart(guest()), { ok: true, removed: 3 });
    assert.deepEqual(await cartIds(), []);
    assert.deepEqual(s3.deleted.sort(), [storageKeyOf("doc-a"), storageKeyOf("doc-b"), storageKeyOf("doc-up")].sort());

    assert.deepEqual(await clearGuestCart(guest()), { ok: true, removed: 0 });
  });

  it("leaves a placed order and its files alone", async () => {
    await seedGuest([cartDocument("doc-a")]);
    const placed = await submit();

    assert.deepEqual(await clearGuestCart(guest()), { ok: true, removed: 0 });
    assert.equal((await readOrder(shopId, placed.order?.id ?? "")).status, "SUBMITTED");
    assert.deepEqual(s3.deleted, []);
  });
});

describe("cancelGuestOrder", () => {
  async function placed(paymentMethod: "CASH" | "ONLINE" = "ONLINE") {
    await seedGuest([cartDocument("doc-a"), cartDocument("doc-b")]);
    const result = await submit({ paymentMethod });
    assert.ok(result.order);
    return result.order.id;
  }

  it("cancels an unpaid order, updates its tracking copy and deletes its files", async () => {
    const orderId = await placed();

    const tracking = await cancelGuestOrder(guest(), orderId);

    assert.equal(tracking.status, "CANCELLED");
    const order = await readOrder(shopId, orderId);
    assert.equal(order.status, "CANCELLED");
    assert.equal(order.cancellation.reason, "GUEST_CANCELLED");
    assert.ok(order.lifecycle.cancelledAt);
    assert.ok((order.documents as Array<{ shreddedAt: string | null }>).every((entry) => entry.shreddedAt));
    assert.equal((await db().doc(`orderTracking/${orderId}`).get()).get("status"), "CANCELLED");
    assert.deepEqual(s3.deleted.sort(), [storageKeyOf("doc-a"), storageKeyOf("doc-b")].sort());
  });

  it("is idempotent, and also cancels an unpaid cash order", async () => {
    const orderId = await placed("CASH");
    await cancelGuestOrder(guest(), orderId);
    const deletes = s3.deleted.length;

    assert.equal((await cancelGuestOrder(guest(), orderId)).status, "CANCELLED");
    assert.equal(s3.deleted.length, deletes);
  });

  it("refuses another guest's order, an accepted order and a paid one", async () => {
    const orderId = await placed();
    await assert.rejects(cancelGuestOrder(guest("guest-2"), orderId), rejectsWith(403, "this order does not belong to the guest session"));

    await db().doc(`shops/${shopId}/orders/${orderId}`).update({ status: "SHOP_ACCEPTED" });
    await assert.rejects(cancelGuestOrder(guest(), orderId), rejectsWith(409, "ORDER_NOT_CANCELLABLE"));

    await db().doc(`shops/${shopId}/orders/${orderId}`).update({ status: "SUBMITTED", "payment.status": "PAID" });
    await assert.rejects(cancelGuestOrder(guest(), orderId), rejectsWith(409, "ORDER_ALREADY_PAID"));
    assert.deepEqual(s3.deleted, []);
  });

  it("stops a payment from landing on a cancelled order", async () => {
    const orderId = await placed();
    await cancelGuestOrder(guest(), orderId);

    await assert.rejects(
      confirmOnlinePayment(shopId, orderId, { paymentReference: "late-ref", idempotencyKey: "late-key" }),
      rejectsWith(409, "ORDER_CANCELLED"),
    );
    assert.equal((await readOrder(shopId, orderId)).payment.status, "PENDING");
  });
});

describe("checkout races", () => {
  it("a delete racing checkout never deletes a file the order needs", async () => {
    for (let round = 0; round < 6; round += 1) {
      await clearFirestore();
      await seedShop(shopId);
      await db().doc(`shops/${shopId}`).set({ pricing: { bwA4PricePaise: 200, colorA4PricePaise: 1000, colorA3PricePaise: 2000 } }, { merge: true });
      s3.deleted.length = 0;
      await seedGuest([cartDocument("doc-a"), cartDocument("doc-b")]);

      const [order, deleted] = await Promise.allSettled([submit(), deleteGuestDocument(guest(), "doc-a")]);

      assert.equal(order.status, "fulfilled");
      await assertNoOrderLostItsFile();
      const ordered = ((await readOrder(shopId, order.status === "fulfilled" ? order.value.order?.id ?? "" : "")).documents as Array<{ id: string }>).map((entry) => entry.id);
      if (ordered.includes("doc-a")) {
        // Checkout won: the delete found the entry gone and refused.
        assert.equal(deleted.status, "rejected");
        assert.ok(rejectsWith(409, "ALREADY_ORDERED")(deleted.status === "rejected" ? deleted.reason : null));
      } else {
        // The delete won: the order has the rest, and only doc-a's file went.
        assert.deepEqual(ordered, ["doc-b"]);
        assert.deepEqual(s3.deleted, [storageKeyOf("doc-a")]);
      }
      assert.deepEqual(await cartIds(), []);
    }
  });

  it("a clear all racing checkout never deletes a file the order needs", async () => {
    for (let round = 0; round < 6; round += 1) {
      await clearFirestore();
      await seedShop(shopId);
      await db().doc(`shops/${shopId}`).set({ pricing: { bwA4PricePaise: 200, colorA4PricePaise: 1000, colorA3PricePaise: 2000 } }, { merge: true });
      s3.deleted.length = 0;
      await seedGuest([cartDocument("doc-a"), cartDocument("doc-b")]);

      const [order, cleared] = await Promise.allSettled([submit(), clearGuestCart(guest())]);

      assert.equal(cleared.status, "fulfilled");
      await assertNoOrderLostItsFile();
      if (order.status === "fulfilled") {
        // Checkout won: nothing was left to clear.
        assert.equal(cleared.status === "fulfilled" ? cleared.value.removed : -1, 0);
      } else {
        // The clear won: no order, and both files are gone.
        assert.ok(rejectsWith(400, "upload at least one document")(order.reason));
        assert.deepEqual(await orderIds(), []);
        assert.deepEqual(s3.deleted.sort(), [storageKeyOf("doc-a"), storageKeyOf("doc-b")].sort());
      }
      assert.deepEqual(await cartIds(), []);
    }
  });
});
