import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COOKIE_REFRESH_MS, cookieSecret, shouldReissueCookie, signGuestCookie, verifyGuestCookie } from "./print-user-cookie.ts";

const secret = "s".repeat(40);
const now = Date.parse("2026-10-15T10:00:00.000Z");
const guest = { id: "guest-1", shopId: "shop-1", expiresAt: now + 12 * 60 * 60 * 1000 };

describe("guest cookie", () => {
  it("round-trips a signed cookie with no read", () => {
    const cookie = signGuestCookie(guest, "203.0.113.10", secret);
    assert.deepEqual(verifyGuestCookie(cookie, "203.0.113.10", secret, now), {
      ...guest,
      expiresAt: Math.floor(guest.expiresAt / 1000) * 1000,
    });
  });

  it("rejects tampering, another key, another network, expiry and old raw cookies", () => {
    const cookie = signGuestCookie(guest, "203.0.113.10", secret);
    const [version, , shopId, expires, ip, mac] = cookie.split(".");
    assert.equal(verifyGuestCookie([version, "guest-2", shopId, expires, ip, mac].join("."), "203.0.113.10", secret, now), null);
    assert.equal(verifyGuestCookie(cookie, "203.0.113.10", "t".repeat(40), now), null);
    assert.equal(verifyGuestCookie(cookie, "198.51.100.7", secret, now), null);
    assert.equal(verifyGuestCookie(cookie, "203.0.113.10", secret, guest.expiresAt + 1000), null);
    assert.equal(verifyGuestCookie("guest-1", "203.0.113.10", secret, now), null);
    assert.equal(verifyGuestCookie(undefined, "203.0.113.10", secret, now), null);
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
