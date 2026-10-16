// Guest session start against the Firestore emulator: the cookie alone identifies the guest. A
// session resumes from any network, and visitors who share an IP never share a cart.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createOrResumePrintUserSession } from "@/src/modules/print-user/print-user-session.service";

import { clearFirestore, db, newShopId } from "./harness.ts";

const SHOP_WIFI_IP = "203.0.113.7";
const MOBILE_IP = "198.51.100.42";

let shopId: string;

async function seedGuest(id: string, fields: Record<string, unknown> = {}) {
  await db().doc(`printUsers/${id}`).set({
    id,
    shopId,
    shopSlug: "test-shop",
    ipAddress: SHOP_WIFI_IP,
    documents: [{ id: "doc-a", originalFilename: "doc-a.pdf", mimeType: "application/pdf", status: "READY", storageKey: "k" }],
    activeOrderId: null,
    createdAt: new Date(),
    lastSeenAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...fields,
  });
}

function start(input: { ipAddress: string; cookiePrintUserId?: string; shopId?: string }) {
  return createOrResumePrintUserSession({
    shopId: input.shopId ?? shopId,
    shopSlug: "test-shop",
    ipAddress: input.ipAddress,
    cookiePrintUserId: input.cookiePrintUserId,
  });
}

async function guestCount() {
  return (await db().collection("printUsers").get()).size;
}

beforeEach(async () => {
  await clearFirestore();
  shopId = newShopId();
});

describe("createOrResumePrintUserSession", () => {
  it("resumes the cookie's cart from a new network", async () => {
    await seedGuest("guest-1");

    const session = await start({ ipAddress: MOBILE_IP, cookiePrintUserId: "guest-1" });

    assert.equal(session.id, "guest-1");
    assert.deepEqual(session.documents.map((entry) => entry.id), ["doc-a"]);
    assert.equal(await guestCount(), 1);
  });

  it("gives a visitor with no cookie their own empty cart, even on a shared IP", async () => {
    await seedGuest("guest-1");

    const session = await start({ ipAddress: SHOP_WIFI_IP });

    assert.notEqual(session.id, "guest-1");
    assert.deepEqual(session.documents, []);
    assert.equal(await guestCount(), 2);
    const stored = (await db().doc(`printUsers/${session.id}`).get()).data() ?? {};
    assert.equal(stored.ipAddress, SHOP_WIFI_IP);
    assert.deepEqual(stored.documents, []);
  });

  it("starts a new cart for a cookie from another shop, an ended session or a missing one", async () => {
    await seedGuest("guest-other-shop", { shopId: "another-shop" });
    await seedGuest("guest-ended", { expiresAt: new Date(Date.now() - 1000) });

    for (const cookiePrintUserId of ["guest-other-shop", "guest-ended", "guest-missing"]) {
      const session = await start({ ipAddress: SHOP_WIFI_IP, cookiePrintUserId });
      assert.notEqual(session.id, cookiePrintUserId);
      assert.deepEqual(session.documents, []);
    }
  });

  it("extends the resumed session", async () => {
    await seedGuest("guest-1", { expiresAt: new Date(Date.now() + 60 * 1000) });

    const session = await start({ ipAddress: MOBILE_IP, cookiePrintUserId: "guest-1" });

    assert.ok(Date.parse(session.expiresAt ?? "") > Date.now() + 60 * 60 * 1000);
  });
});
