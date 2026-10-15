// Security rules tests (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 7.3).
// Run against the emulators with `pnpm firebase:rules:test` from the repo root (needs Java 11+).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { get, ref, set } from "firebase/database";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

const root = new URL("../", import.meta.url);
let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-ctrlp-rules",
    firestore: { rules: readFileSync(new URL("firestore.rules", root), "utf8") },
    database: { rules: readFileSync(new URL("database.rules.json", root), "utf8") },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "orderTracking/order-1"), { orderId: "order-1", shopId: "A", printUserId: "guest-1", status: "SUBMITTED" });
    await setDoc(doc(db, "orderTracking/order-2"), { orderId: "order-2", shopId: "A", printUserId: "guest-2", status: "SUBMITTED" });
    await setDoc(doc(db, "shops/A/orders/order-1"), { status: "SUBMITTED" });
    await setDoc(doc(db, "shops/A/orders/order-1/printJobs/job-1"), { status: "QUEUED" });
    await set(ref(context.database(), "doorbell/A"), { boardAt: 1, workAt: 1 });
    await set(ref(context.database(), "doorbell/B"), { boardAt: 1, workAt: 1 });
  });
});

describe("Firestore rules", () => {
  it("lets a guest get their own tracking document", async () => {
    const db = env.authenticatedContext("guest-1").firestore();
    await assertSucceeds(getDoc(doc(db, "orderTracking/order-1")));
  });

  it("denies a guest another guest's tracking document", async () => {
    const db = env.authenticatedContext("guest-1").firestore();
    await assertFails(getDoc(doc(db, "orderTracking/order-2")));
  });

  it("denies unauthenticated tracking reads", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "orderTracking/order-1")));
  });

  it("denies listing tracking documents", async () => {
    const db = env.authenticatedContext("guest-1").firestore();
    await assertFails(getDocs(collection(db, "orderTracking")));
  });

  it("keeps shop orders and jobs server-only, even for that shop's users", async () => {
    const db = env.authenticatedContext("owner-1", { shopId: "A", shopUserId: "u1", role: "OWNER" }).firestore();
    await assertFails(getDoc(doc(db, "shops/A/orders/order-1")));
    await assertFails(getDoc(doc(db, "shops/A/orders/order-1/printJobs/job-1")));
  });

  it("denies every client write", async () => {
    const guest = env.authenticatedContext("guest-1").firestore();
    await assertFails(setDoc(doc(guest, "orderTracking/order-1"), { status: "READY" }, { merge: true }));
    const owner = env.authenticatedContext("owner-1", { shopId: "A" }).firestore();
    await assertFails(setDoc(doc(owner, "shops/A/orders/order-1"), { status: "READY" }, { merge: true }));
  });
});

describe("Realtime Database rules", () => {
  it("lets a shop A user read /doorbell/A", async () => {
    const db = env.authenticatedContext("owner-1", { shopId: "A" }).database();
    const snapshot = await assertSucceeds(get(ref(db, "doorbell/A")));
    assert.equal(snapshot.val().workAt, 1);
  });

  it("denies a shop A user /doorbell/B", async () => {
    const db = env.authenticatedContext("owner-1", { shopId: "A" }).database();
    await assertFails(get(ref(db, "doorbell/B")));
  });

  it("denies unauthenticated and claim-less reads", async () => {
    await assertFails(get(ref(env.unauthenticatedContext().database(), "doorbell/A")));
    await assertFails(get(ref(env.authenticatedContext("guest-1").database(), "doorbell/A")));
  });

  it("denies reading the root", async () => {
    const db = env.authenticatedContext("owner-1", { shopId: "A" }).database();
    await assertFails(get(ref(db, "/")));
  });

  it("denies every client write", async () => {
    const db = env.authenticatedContext("owner-1", { shopId: "A" }).database();
    await assertFails(set(ref(db, "doorbell/A/workAt"), 2));
  });
});
