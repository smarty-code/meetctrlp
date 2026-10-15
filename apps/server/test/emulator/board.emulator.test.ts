// getBoard, listOrderHistory and searchOrders against the Firestore emulator.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { getBoard, listOrderHistory, searchOrders } from "@/src/modules/orders/board.service";

import { clearFirestore, db, minutesAgo, newShopId, principalFor, seedJob, seedOrder } from "./harness.ts";

let shopId: string;

function secondsAgo(seconds: number) {
  return new Date(Date.now() - seconds * 1000);
}

/** Writes `count` orders in one batch. */
async function seedManyOrders(count: number, fields: (index: number) => Record<string, unknown>) {
  const batch = db().batch();
  for (let index = 0; index < count; index += 1) {
    const id = `bulk-${String(index).padStart(3, "0")}`;
    batch.set(db().doc(`shops/${shopId}/orders/${id}`), { id, shopId, status: "COMPLETED", ...fields(index) });
  }
  await batch.commit();
}

function ids(entries: Array<{ id: string }>) {
  return entries.map((entry) => entry.id);
}

beforeEach(async () => {
  await clearFirestore();
  shopId = newShopId();
});

describe("getBoard: full board", () => {
  it("returns active orders newest first and unfinished jobs of this shop only", async () => {
    await seedOrder(shopId, "submitted", { status: "SUBMITTED", createdAt: minutesAgo(10) });
    await seedOrder(shopId, "printing", { status: "PRINTING", createdAt: minutesAgo(5) });
    await seedOrder(shopId, "ready", { status: "READY", createdAt: minutesAgo(20) });
    await seedOrder(shopId, "accepted", { status: "SHOP_ACCEPTED", createdAt: minutesAgo(15) });
    await seedOrder(shopId, "completed", { status: "COMPLETED", createdAt: minutesAgo(1) });
    await seedOrder(shopId, "rejected", { status: "REJECTED", createdAt: minutesAgo(2) });
    for (const status of ["QUEUED", "DISPATCHING", "PRINTING", "FAILED", "COMPLETED", "CANCELLED"]) {
      await seedJob(shopId, "printing", `job-${status.toLowerCase()}`, { status });
    }
    const otherShop = newShopId();
    await seedOrder(otherShop, "other", { status: "SUBMITTED" });
    await seedJob(otherShop, "other", "job-other-shop", { status: "QUEUED" });

    const startedAt = Date.now();
    const board = await getBoard(principalFor(shopId), undefined);

    assert.equal(board.full, true);
    assert.deepEqual(ids(board.orders), ["printing", "submitted", "accepted", "ready"]);
    assert.deepEqual(ids(board.jobs).sort(), ["job-dispatching", "job-failed", "job-printing", "job-queued"]);
    const cursor = Date.parse(board.cursor);
    assert.ok(cursor >= startedAt - 1000 && cursor <= Date.now());
  });
});

describe("getBoard: deltas", () => {
  it("returns what changed since the cursor, with a 5 s overlap", async () => {
    const since = secondsAgo(60).toISOString();
    await seedOrder(shopId, "in-overlap", { status: "SUBMITTED", updatedAt: secondsAgo(63) });
    await seedOrder(shopId, "before-cursor", { status: "SUBMITTED", updatedAt: secondsAgo(70) });
    await seedOrder(shopId, "changed", { status: "PRINTING", updatedAt: secondsAgo(10) });
    await seedOrder(shopId, "finished", { status: "COMPLETED", updatedAt: secondsAgo(5) });
    await seedJob(shopId, "changed", "job-changed", { status: "COMPLETED", updatedAt: secondsAgo(10) });
    await seedJob(shopId, "changed", "job-old", { status: "QUEUED", updatedAt: secondsAgo(120) });

    const board = await getBoard(principalFor(shopId), since);

    assert.equal(board.full, false);
    assert.deepEqual(ids(board.orders), ["in-overlap", "changed", "finished"]);
    assert.deepEqual(ids(board.jobs), ["job-changed"]);
    assert.ok(Date.parse(board.cursor) > Date.parse(since));
  });

  it("sends up to 200 changes as a delta", async () => {
    await seedManyOrders(200, () => ({ updatedAt: secondsAgo(1) }));

    const board = await getBoard(principalFor(shopId), secondsAgo(60).toISOString());

    assert.equal(board.full, false);
    assert.equal(board.orders.length, 200);
  });

  it("sends the full board instead of more than 200 changes", async () => {
    await seedManyOrders(201, () => ({ updatedAt: secondsAgo(1) }));
    await seedOrder(shopId, "active", { status: "SUBMITTED", updatedAt: minutesAgo(30) });

    const board = await getBoard(principalFor(shopId), secondsAgo(60).toISOString());

    assert.equal(board.full, true);
    assert.deepEqual(ids(board.orders), ["active"]);
  });

  it("sends the full board for a cursor older than a day, from the future, or unreadable", async () => {
    await seedOrder(shopId, "active", { status: "SUBMITTED", updatedAt: minutesAgo(30) });
    await seedOrder(shopId, "finished", { status: "COMPLETED", updatedAt: secondsAgo(5) });

    for (const since of [new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), new Date(Date.now() + 60_000).toISOString(), "yesterday"]) {
      const board = await getBoard(principalFor(shopId), since);
      assert.equal(board.full, true, since);
      assert.deepEqual(ids(board.orders), ["active"], since);
    }
  });
});

describe("listOrderHistory", () => {
  beforeEach(async () => {
    // Shop time is UTC+05:30, so "late" falls on 2026-10-11 in the shop but 2026-10-10 in UTC.
    await seedOrder(shopId, "early", { status: "COMPLETED", createdAt: new Date("2026-10-10T10:00:00+05:30") });
    await seedOrder(shopId, "late", { status: "REJECTED", createdAt: new Date("2026-10-11T00:30:00+05:30") });
    await seedOrder(shopId, "evening", { status: "COMPLETED", createdAt: new Date("2026-10-11T23:00:00+05:30") });
    await seedOrder(shopId, "next-day", { status: "SUBMITTED", createdAt: new Date("2026-10-12T09:00:00+05:30") });
  });

  it("filters by shop-time date and status, newest first", async () => {
    const day = await listOrderHistory(principalFor(shopId), { status: [], from: "2026-10-11", to: "2026-10-11", limit: 50 });
    assert.deepEqual(ids(day.orders), ["evening", "late"]);
    assert.equal(day.nextCursor, null);

    const completed = await listOrderHistory(principalFor(shopId), { status: ["COMPLETED"], limit: 50 });
    assert.deepEqual(ids(completed.orders), ["evening", "early"]);
  });

  it("pages with a cursor", async () => {
    const first = await listOrderHistory(principalFor(shopId), { status: [], limit: 2 });
    assert.deepEqual(ids(first.orders), ["next-day", "evening"]);
    assert.equal(first.nextCursor, "evening");

    const second = await listOrderHistory(principalFor(shopId), { status: [], limit: 2, cursor: first.nextCursor ?? undefined });
    assert.deepEqual(ids(second.orders), ["late", "early"]);
    assert.equal(second.nextCursor, null);
  });
});

describe("searchOrders", () => {
  it("matches exact search keys, newest first", async () => {
    await seedOrder(shopId, "older", { searchKeys: ["ord-1001", "1001", "invoice"], createdAt: minutesAgo(30) });
    await seedOrder(shopId, "newer", { searchKeys: ["ord-1002", "1002", "invoice"], createdAt: minutesAgo(5) });
    await seedOrder(shopId, "unrelated", { searchKeys: ["ord-1003", "1003", "resume"], createdAt: minutesAgo(1) });

    const invoices = await searchOrders(principalFor(shopId), { q: "invoice" });
    assert.deepEqual(ids(invoices.orders), ["newer", "older"]);
    assert.equal(invoices.nextCursor, null);

    assert.deepEqual(ids((await searchOrders(principalFor(shopId), { q: "1001" })).orders), ["older"]);
    assert.deepEqual((await searchOrders(principalFor(shopId), { q: "invo" })).orders, []);
  });

  it("pages 50 results at a time", async () => {
    await seedManyOrders(51, (index) => ({ searchKeys: ["bulk"], createdAt: minutesAgo(100 - index) }));

    const first = await searchOrders(principalFor(shopId), { q: "bulk" });
    assert.equal(first.orders.length, 50);
    assert.equal(first.orders[0].id, "bulk-050");
    assert.equal(first.nextCursor, "bulk-001");

    const second = await searchOrders(principalFor(shopId), { q: "bulk", cursor: first.nextCursor ?? undefined });
    assert.deepEqual(ids(second.orders), ["bulk-000"]);
    assert.equal(second.nextCursor, null);
  });
});
