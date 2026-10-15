import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDottedUpdate,
  buildSearchKeys,
  canTransition,
  decideTransition,
  touchesTrackingCopy,
  trackingCopy,
} from "./order-model.ts";

describe("order transitions", () => {
  it("allows only the forward steps", () => {
    assert.equal(canTransition("SUBMITTED", "SHOP_ACCEPTED"), true);
    assert.equal(canTransition("SUBMITTED", "CANCELLED"), true);
    assert.equal(canTransition("SHOP_ACCEPTED", "PRINTING"), true);
    assert.equal(canTransition("PRINTING", "READY"), true);
    assert.equal(canTransition("READY", "COMPLETED"), true);
    assert.equal(canTransition("SHOP_ACCEPTED", "READY"), false);
    assert.equal(canTransition("COMPLETED", "READY"), false);
    assert.equal(canTransition("UNKNOWN", "READY"), false);
  });

  it("treats a request for the current status as a replay", () => {
    assert.deepEqual(
      decideTransition({ current: "SHOP_ACCEPTED", next: "SHOP_ACCEPTED", requiredFrom: "SUBMITTED", expected: "SUBMITTED" }),
      { kind: "replay" },
    );
  });

  it("applies from the required status when the client agrees", () => {
    assert.deepEqual(
      decideTransition({ current: "SUBMITTED", next: "SHOP_ACCEPTED", requiredFrom: "SUBMITTED", expected: "SUBMITTED" }),
      { kind: "apply" },
    );
  });

  it("rejects any other status with 409 reasons", () => {
    assert.deepEqual(
      decideTransition({ current: "CANCELLED", next: "SHOP_ACCEPTED", requiredFrom: "SUBMITTED" }),
      { kind: "conflict", reason: "ORDER_ALREADY_CANCELLED" },
    );
    assert.deepEqual(
      decideTransition({ current: "READY", next: "SHOP_ACCEPTED", requiredFrom: "SUBMITTED" }),
      { kind: "conflict", reason: "ORDER_STATUS_CONFLICT" },
    );
    assert.deepEqual(
      decideTransition({ current: "SUBMITTED", next: "SHOP_ACCEPTED", requiredFrom: "SUBMITTED", expected: "PRINTING" }),
      { kind: "conflict", reason: "ORDER_STATUS_CONFLICT" },
    );
  });
});

describe("search keys", () => {
  it("indexes order number, pickup code, phone and filename words", () => {
    const keys = buildSearchKeys({
      orderNumber: "ORD-1042",
      pickupCode: "1042",
      customerPhone: "+91 98000 11122",
      filenames: ["Resume_Final v2.pdf", "ID-card.png"],
    });
    for (const key of ["ord-1042", "1042", "919800011122", "9800011122", "resume", "final", "card"]) {
      assert.ok(keys.includes(key), `missing ${key}`);
    }
    assert.ok(!keys.includes("pdf"), "extensions are dropped");
    assert.ok(!keys.includes("v2"), "words under 3 characters are dropped");
    assert.equal(new Set(keys).size, keys.length);
  });

  it("caps the number of keys", () => {
    const filenames = Array.from({ length: 60 }, (_, index) => `file${index}word.pdf`);
    assert.equal(buildSearchKeys({ orderNumber: "ORD-1", pickupCode: "0001", filenames }).length, 40);
  });
});

describe("tracking copy", () => {
  const order = {
    id: "o1",
    shopId: "s1",
    printUserId: "g1",
    orderNumber: "ORD-1042",
    pickupCode: "1042",
    status: "SUBMITTED",
    payment: { method: "ONLINE", status: "PAID", reference: "pay_secret", collectedByUserId: "u9" },
    amounts: { totalMinorUnits: 1200 },
    documents: [
      { originalFilename: "a.pdf", pageCount: 3, copies: 2, colorMode: "BW", paperSize: "A4", totalPaise: 1200, mimeType: "application/pdf", storageKey: "secret/key", config: { billablePages: 2 } },
    ],
    rejection: { reason: null },
    lifecycle: { submittedAt: "t0", acceptedByUserId: "u9" },
  };

  it("keeps only customer-safe fields", () => {
    const copy = trackingCopy(order);
    const text = JSON.stringify(copy);
    assert.ok(!text.includes("pay_secret"));
    assert.ok(!text.includes("secret/key"));
    assert.ok(!text.includes("u9"));
    assert.deepEqual(copy.payment, { method: "ONLINE", status: "PAID" });
    assert.equal(copy.totalPaise, 1200);
    assert.deepEqual(copy.items[0], {
      name: "a.pdf",
      pageCount: 3,
      billablePages: 2,
      copies: 2,
      colorMode: "BW",
      paperSize: "A4",
      totalPaise: 1200,
      mimeType: "application/pdf",
    });
    assert.equal(copy.times.submittedAt, "t0");
    assert.equal(copy.times.readyAt, null);
  });

  it("reflects a pending dotted update", () => {
    const merged = applyDottedUpdate(order, { status: "SHOP_ACCEPTED", "lifecycle.acceptedAt": "t1" });
    assert.equal(trackingCopy(merged).status, "SHOP_ACCEPTED");
    assert.equal(trackingCopy(merged).times.acceptedAt, "t1");
    assert.equal(trackingCopy(merged).times.submittedAt, "t0");
    assert.equal(order.status, "SUBMITTED", "the input isn't modified");
    assert.equal((order.lifecycle as Record<string, unknown>).acceptedAt, undefined);
  });

  it("knows which updates the customer can see", () => {
    assert.equal(touchesTrackingCopy({ status: "READY" }), true);
    assert.equal(touchesTrackingCopy({ "payment.status": "PAID" }), true);
    assert.equal(touchesTrackingCopy({ completedDocumentIds: ["d1"] }), false);
    assert.equal(touchesTrackingCopy({ print: {} }), false);
  });
});
