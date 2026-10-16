import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { COOKIE_REFRESH_MS, cookieSecret, shouldReissueCookie, signGuestCookie, verifyGuestCookie } from "./print-user-cookie.ts";

const secret = "s".repeat(40);
const now = Date.parse("2026-10-15T10:00:00.000Z");
const guest = { id: "guest-1", shopId: "shop-1", expiresAt: now + 12 * 60 * 60 * 1000 };
const verified = { ...guest, expiresAt: Math.floor(guest.expiresAt / 1000) * 1000 };

/** A cookie in the old v1 format, which carried a tag of the client IP before the hmac. */
function legacyCookie(ipAddress: string, key = secret) {
  const ipTag = createHash("sha256").update(ipAddress).digest("base64url").slice(0, 16);
  const payload = ["v1", guest.id, guest.shopId, Math.floor(guest.expiresAt / 1000), ipTag].join(".");
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}

describe("guest cookie", () => {
  it("round-trips a signed v2 cookie with no read", () => {
    const cookie = signGuestCookie(guest, secret);
    assert.equal(cookie.split(".").length, 5);
    assert.equal(cookie.split(".")[0], "v2");
    assert.deepEqual(verifyGuestCookie(cookie, secret, now), verified);
  });

  it("carries no client IP, so a guest keeps their session across networks", () => {
    assert.equal(signGuestCookie(guest, secret).includes(createHash("sha256").update("203.0.113.10").digest("base64url").slice(0, 16)), false);
  });

  it("still accepts a v1 cookie, whatever network it was issued on", () => {
    assert.deepEqual(verifyGuestCookie(legacyCookie("203.0.113.10"), secret, now), verified);
    assert.deepEqual(verifyGuestCookie(legacyCookie("198.51.100.7"), secret, now), verified);
    assert.equal(verifyGuestCookie(legacyCookie("203.0.113.10", "t".repeat(40)), secret, now), null);
  });

  it("rejects tampering, another key, expiry, mixed formats and old raw cookies", () => {
    const cookie = signGuestCookie(guest, secret);
    const [version, , shopId, expires, mac] = cookie.split(".");
    assert.equal(verifyGuestCookie([version, "guest-2", shopId, expires, mac].join("."), secret, now), null);
    assert.equal(verifyGuestCookie(cookie, "t".repeat(40), now), null);
    assert.equal(verifyGuestCookie(cookie, secret, guest.expiresAt + 1000), null);
    // A v2 payload relabelled v1, or a v1 cookie relabelled v2, fails its signature or its shape.
    assert.equal(verifyGuestCookie(["v1", guest.id, shopId, expires, "tag", mac].join("."), secret, now), null);
    assert.equal(verifyGuestCookie(legacyCookie("203.0.113.10").replace(/^v1/, "v2"), secret, now), null);
    assert.equal(verifyGuestCookie("guest-1", secret, now), null);
    assert.equal(verifyGuestCookie(undefined, secret, now), null);
  });

  it("re-issues at most once an hour", () => {
    const ttl = 12 * 60 * 60 * 1000;
    assert.equal(shouldReissueCookie({ ...guest, expiresAt: now + ttl }, ttl, now), false);
    assert.equal(shouldReissueCookie({ ...guest, expiresAt: now + ttl - COOKIE_REFRESH_MS + 1000 }, ttl, now), false);
    assert.equal(shouldReissueCookie({ ...guest, expiresAt: now + ttl - COOKIE_REFRESH_MS - 1000 }, ttl, now), true);
  });

  it("needs a real secret in production only", () => {
    assert.throws(() => cookieSecret({ NODE_ENV: "production" }), /PRINT_USER_COOKIE_SECRET/);
    assert.throws(() => cookieSecret({ NODE_ENV: "production", PRINT_USER_COOKIE_SECRET: "short" }), /PRINT_USER_COOKIE_SECRET/);
    assert.equal(cookieSecret({ NODE_ENV: "production", PRINT_USER_COOKIE_SECRET: secret }), secret);
    assert.equal(cookieSecret({ NODE_ENV: "development" }), cookieSecret({ NODE_ENV: "development" }));
  });
});
