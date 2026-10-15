// Daily clean-up (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.10), run by Cloud Scheduler.
import { deleteObject, getFirebaseAuth, isMissingObjectError } from "@ctrlp/firebase";
import { getFirebaseFirestore } from "@ctrlp/firebase/firestore";

import { shredOrderDocument, type StoredOrderDocument } from "@/src/modules/documents/document.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const TRACKING_KEEP_MS = 30 * DAY_MS;
const BATCH = 300;

/** 1. Tracking copies of orders that finished more than 30 days ago. */
async function deleteOldTrackingCopies() {
  const db = getFirebaseFirestore();
  const snapshot = await db
    .collection("orderTracking")
    .where("status", "in", ["COMPLETED", "REJECTED", "CANCELLED"])
    .where("updatedAt", "<", new Date(Date.now() - TRACKING_KEEP_MS))
    .limit(BATCH)
    .get();
  if (snapshot.empty) {
    return 0;
  }
  const batch = db.batch();
  for (const document of snapshot.docs) {
    batch.delete(document.ref);
  }
  await batch.commit();
  return snapshot.size;
}

/**
 * 2. Expired guest sessions: files still in the cart (never ordered; ordered files leave the cart at
 * checkout), the guest's Firebase Auth user from the tracking sign-in, and the session itself.
 */
async function deleteExpiredGuestSessions() {
  const db = getFirebaseFirestore();
  const snapshot = await db.collection("printUsers").where("expiresAt", "<", new Date()).limit(BATCH).get();
  if (snapshot.empty) {
    return { sessions: 0, files: 0 };
  }

  let files = 0;
  for (const session of snapshot.docs) {
    const documents = Array.isArray(session.get("documents")) ? (session.get("documents") as Array<{ storageKey?: string }>) : [];
    for (const document of documents) {
      if (!document.storageKey) {
        continue;
      }
      try {
        await deleteObject(document.storageKey);
        files += 1;
      } catch (error) {
        if (!isMissingObjectError(error)) {
          console.error("Failed to delete an abandoned guest file", session.id, error);
        }
      }
    }
  }

  // Guests who never opened tracking have no Auth user; deleteUsers ignores those.
  await getFirebaseAuth().deleteUsers(snapshot.docs.map((session) => session.id)).catch((error: unknown) => {
    console.error("Failed to delete guest Auth users", error);
  });

  const batch = db.batch();
  for (const session of snapshot.docs) {
    batch.delete(session.ref);
  }
  await batch.commit();
  return { sessions: snapshot.size, files };
}

/**
 * 3. Files of orders rejected or cancelled 1–8 days ago. A week-long window keeps each run bounded;
 * an order whose files are already gone costs one read.
 */
async function deleteFilesOfDroppedOrders() {
  const db = getFirebaseFirestore();
  const from = new Date(Date.now() - 8 * DAY_MS);
  const to = new Date(Date.now() - DAY_MS);
  const [rejected, cancelled] = await Promise.all([
    db.collectionGroup("orders").where("status", "==", "REJECTED")
      .where("lifecycle.rejectedAt", ">=", from).where("lifecycle.rejectedAt", "<", to).limit(BATCH).get(),
    db.collectionGroup("orders").where("status", "==", "CANCELLED")
      .where("lifecycle.cancelledAt", ">=", from).where("lifecycle.cancelledAt", "<", to).limit(BATCH).get(),
  ]);

  let files = 0;
  for (const order of [...rejected.docs, ...cancelled.docs]) {
    const shopId = String(order.get("shopId") ?? order.ref.parent.parent?.id ?? "");
    const documents = (order.get("documents") ?? []) as StoredOrderDocument[];
    for (const document of documents) {
      if (document.shreddedAt || !document.storageKey) {
        continue;
      }
      if (await shredOrderDocument(shopId, order.id, document.docId ?? document.id)) {
        files += 1;
      }
    }
  }
  return files;
}

export async function runDailyMaintenance() {
  const trackingCopies = await deleteOldTrackingCopies();
  const guests = await deleteExpiredGuestSessions();
  const droppedOrderFiles = await deleteFilesOfDroppedOrders();
  const summary = {
    trackingCopies,
    guestSessions: guests.sessions,
    guestFiles: guests.files,
    droppedOrderFiles,
    // Each step handles at most 300 items; run again if any number reached it.
    more: trackingCopies >= BATCH || guests.sessions >= BATCH,
  };
  console.log(JSON.stringify({ severity: "INFO", message: "maintenance_daily", ...summary }));
  return summary;
}
