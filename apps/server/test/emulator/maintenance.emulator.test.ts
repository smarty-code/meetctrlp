// runDailyMaintenance against the Firestore and Auth emulators.
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { getFirebaseAuth } from "@ctrlp/firebase";

import { runDailyMaintenance } from "@/src/modules/maintenance/maintenance.service";

import {
  DAY_MS,
  clearAuth,
  clearFirestore,
  daysAgo,
  db,
  minutesAgo,
  newShopId,
  readOrder,
  seedOrder,
  startFakeS3,
  storedDocument,
  type FakeS3,
} from "./harness.ts";

let s3: FakeS3;
let shopId: string;

async function exists(path: string) {
  return (await db().doc(path).get()).exists;
}

async function authUserExists(uid: string) {
  try {
    await getFirebaseAuth().getUser(uid);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") {
      return false;
    }
    throw error;
  }
}

async function seedGuest(id: string, expiresAt: Date, storageKeys: string[]) {
  await db().doc(`printUsers/${id}`).set({
    id,
    expiresAt,
    documents: [...storageKeys.map((storageKey) => ({ storageKey })), { originalFilename: "never-uploaded.pdf" }],
  });
}

async function seedDroppedOrder(orderId: string, status: "REJECTED" | "CANCELLED", at: Date, documents = [storedDocument(shopId, orderId, "doc-1")]) {
  const field = status === "REJECTED" ? "rejectedAt" : "cancelledAt";
  await seedOrder(shopId, orderId, { status, lifecycle: { [field]: at }, documents });
}

before(async () => {
  s3 = await startFakeS3();
});

after(async () => {
  await s3.close();
});

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  s3.deleted.length = 0;
  s3.failing.clear();
  shopId = newShopId();
});

describe("runDailyMaintenance", () => {
  it("deletes old tracking copies, expired guests and files of dropped orders", async () => {
    await db().doc("orderTracking/old-completed").set({ status: "COMPLETED", updatedAt: daysAgo(31) });
    await db().doc("orderTracking/old-rejected").set({ status: "REJECTED", updatedAt: daysAgo(40) });
    await db().doc("orderTracking/old-cancelled").set({ status: "CANCELLED", updatedAt: daysAgo(35) });
    await db().doc("orderTracking/recent-completed").set({ status: "COMPLETED", updatedAt: daysAgo(29) });
    await db().doc("orderTracking/old-but-ready").set({ status: "READY", updatedAt: daysAgo(40) });

    await seedGuest("guest-expired", new Date(Date.now() - 60 * 60 * 1000), ["guest/guest-expired/a.pdf", "guest/guest-expired/b.pdf"]);
    await getFirebaseAuth().createUser({ uid: "guest-expired" });
    await seedGuest("guest-never-tracked", new Date(Date.now() - 60 * 1000), []);
    await seedGuest("guest-active", new Date(Date.now() + 60 * 60 * 1000), ["guest/guest-active/a.pdf"]);
    await getFirebaseAuth().createUser({ uid: "guest-active" });

    await seedDroppedOrder("rejected-3d", "REJECTED", daysAgo(3), [
      storedDocument(shopId, "rejected-3d", "doc-1"),
      storedDocument(shopId, "rejected-3d", "doc-2", { shreddedAt: daysAgo(2).toISOString() }),
    ]);
    await seedDroppedOrder("cancelled-2d", "CANCELLED", daysAgo(2));
    await seedDroppedOrder("rejected-10d", "REJECTED", daysAgo(10));
    await seedDroppedOrder("rejected-12h", "REJECTED", new Date(Date.now() - DAY_MS / 2));
    await seedOrder(shopId, "completed-3d", { status: "COMPLETED", lifecycle: { completedAt: daysAgo(3) } });

    const summary = await runDailyMaintenance();

    assert.deepEqual(summary, {
      trackingCopies: 3,
      guestSessions: 2,
      guestFiles: 2,
      unpaidOrdersCancelled: 0,
      droppedOrderFiles: 2,
      more: false,
    });

    assert.equal(await exists("orderTracking/old-completed"), false);
    assert.equal(await exists("orderTracking/old-rejected"), false);
    assert.equal(await exists("orderTracking/old-cancelled"), false);
    assert.equal(await exists("orderTracking/recent-completed"), true);
    assert.equal(await exists("orderTracking/old-but-ready"), true);

    assert.equal(await exists("printUsers/guest-expired"), false);
    assert.equal(await exists("printUsers/guest-never-tracked"), false);
    assert.equal(await exists("printUsers/guest-active"), true);
    assert.equal(await authUserExists("guest-expired"), false);
    assert.equal(await authUserExists("guest-active"), true);

    const shredded = await readOrder(shopId, "rejected-3d");
    assert.ok(shredded.documents[0].shreddedAt);
    assert.ok((await readOrder(shopId, "cancelled-2d")).documents[0].shreddedAt);
    assert.equal((await readOrder(shopId, "rejected-10d")).documents[0].shreddedAt, null);
    assert.equal((await readOrder(shopId, "rejected-12h")).documents[0].shreddedAt, null);
    assert.equal((await readOrder(shopId, "completed-3d")).documents[0].shreddedAt, null);

    assert.deepEqual([...s3.deleted].sort(), [
      "guest/guest-expired/a.pdf",
      "guest/guest-expired/b.pdf",
      `uploads/${shopId}/cancelled-2d/doc-1.pdf`,
      `uploads/${shopId}/rejected-3d/doc-1.pdf`,
    ]);
  });

  it("keeps a dropped order's file marked unshredded when the delete fails, so the next run retries", async () => {
    await seedDroppedOrder("rejected-3d", "REJECTED", daysAgo(3));
    s3.failing.add(`uploads/${shopId}/rejected-3d/doc-1.pdf`);

    assert.equal((await runDailyMaintenance()).droppedOrderFiles, 0);
    assert.equal((await readOrder(shopId, "rejected-3d")).documents[0].shreddedAt, null);

    s3.failing.clear();
    assert.equal((await runDailyMaintenance()).droppedOrderFiles, 1);
    assert.ok((await readOrder(shopId, "rejected-3d")).documents[0].shreddedAt);
  });

  it("cancels online orders unpaid past the payment window and deletes their files, and only those", async () => {
    const online = (status: string) => ({ method: "ONLINE", status });
    const documents = (orderId: string) => [storedDocument(shopId, orderId, "doc-1")];
    await seedOrder(shopId, "unpaid-old", { payment: online("PENDING"), createdAt: minutesAgo(45), documents: documents("unpaid-old") });
    await seedOrder(shopId, "unpaid-new", { payment: online("PENDING"), createdAt: minutesAgo(10), documents: documents("unpaid-new") });
    await seedOrder(shopId, "paid-old", { payment: online("PAID"), createdAt: minutesAgo(45), documents: documents("paid-old") });
    await seedOrder(shopId, "cash-old", { createdAt: minutesAgo(45), documents: documents("cash-old") });
    await seedOrder(shopId, "accepted-old", {
      status: "SHOP_ACCEPTED",
      payment: online("PENDING"),
      createdAt: minutesAgo(45),
      documents: documents("accepted-old"),
    });

    const summary = await runDailyMaintenance();

    assert.equal(summary.unpaidOrdersCancelled, 1);
    const cancelled = await readOrder(shopId, "unpaid-old");
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.cancellation.reason, "PAYMENT_TIMEOUT");
    assert.ok(cancelled.lifecycle.cancelledAt);
    assert.ok(cancelled.documents[0].shreddedAt);
    for (const orderId of ["unpaid-new", "paid-old", "cash-old"]) {
      assert.equal((await readOrder(shopId, orderId)).status, "SUBMITTED", orderId);
    }
    assert.equal((await readOrder(shopId, "accepted-old")).status, "SHOP_ACCEPTED");
    assert.deepEqual(s3.deleted, [`uploads/${shopId}/unpaid-old/doc-1.pdf`]);
  });

  it("removes an expired guest even when one of its files can't be deleted", async () => {
    await seedGuest("guest-expired", new Date(Date.now() - 60 * 1000), ["guest/guest-expired/a.pdf", "guest/guest-expired/b.pdf"]);
    s3.failing.add("guest/guest-expired/a.pdf");

    const summary = await runDailyMaintenance();

    assert.equal(summary.guestSessions, 1);
    assert.equal(summary.guestFiles, 1);
    assert.equal(await exists("printUsers/guest-expired"), false);
    assert.deepEqual(s3.deleted, ["guest/guest-expired/b.pdf"]);
  });
});
