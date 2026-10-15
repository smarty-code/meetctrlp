import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyRingError, doorbellUrl, isEmulatorUrl, mergeRings, ringBody, type Ring } from "./ring-model.ts";

const submitted: Ring = { work: false, event: "order_submitted", orderId: "o1", orderNumber: "ORD-1" };
const queued: Ring = { work: true, event: "jobs_queued", orderId: "o1", orderNumber: "ORD-1" };
const paid: Ring = { work: true, event: "order_paid", orderId: "o2", orderNumber: "ORD-2" };

describe("doorbell ring", () => {
  it("rings board only, or board and work, with database timestamps", () => {
    assert.deepEqual(ringBody(submitted), {
      boardAt: { ".sv": "timestamp" },
      last: { type: "order_submitted", orderId: "o1", orderNumber: "ORD-1" },
    });
    assert.deepEqual(ringBody(queued).workAt, { ".sv": "timestamp" });
  });

  it("merges rings in one request, keeping work and the most important event", () => {
    assert.deepEqual(mergeRings(submitted, queued), { ...submitted, work: true });
    assert.deepEqual(mergeRings(queued, paid), paid);
    assert.deepEqual(mergeRings(paid, { ...submitted, work: false }), paid);
  });

  it("builds the doorbell URL, keeping the emulator namespace", () => {
    assert.equal(
      doorbellUrl("https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app", "shop/1"),
      "https://meetctrlp-default-rtdb.asia-southeast1.firebasedatabase.app/doorbell/shop%2F1.json",
    );
    assert.equal(
      doorbellUrl("http://127.0.0.1:9000?ns=demo-default-rtdb", "s1"),
      "http://127.0.0.1:9000/doorbell/s1.json?ns=demo-default-rtdb",
    );
  });

  it("recognises the emulator", () => {
    assert.equal(isEmulatorUrl("http://127.0.0.1:9000?ns=x"), true);
    assert.equal(isEmulatorUrl("http://localhost:9000"), true);
    assert.equal(isEmulatorUrl("https://x.firebasedatabase.app"), false);
  });

  it("treats a timeout as unknown and other errors as failed", () => {
    assert.equal(classifyRingError(new DOMException("timed out", "TimeoutError")), "unknown");
    assert.equal(classifyRingError(new DOMException("aborted", "AbortError")), "unknown");
    assert.equal(classifyRingError(new TypeError("fetch failed")), "failed");
  });
});
