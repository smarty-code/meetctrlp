import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Signed guest cookie (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.8). It names the guest, their shop and
// when the session ends, so a request is authorized with no Firestore read. It is not bound to the
// caller's IP: a phone changes networks mid-visit, and many visitors share one address.
// Format: v2.<printUserId>.<shopId>.<expiresAtEpochSeconds>.<hmac>
// A v1 cookie (an IP tag before the hmac) still verifies, its tag ignored, until it expires; the
// next re-issue writes v2.

const VERSION = "v2";
const LEGACY_VERSION = "v1";
/** Re-issue the cookie (sliding expiry) at most this often. */
export const COOKIE_REFRESH_MS = 60 * 60 * 1000;

export type GuestPrincipal = {
  /** The guest's printUserId. */
  id: string;
  shopId: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

let devSecret: string | undefined;

/**
 * The signing key. Production must set `PRINT_USER_COOKIE_SECRET`; elsewhere a per-process key is
 * used, so guest cookies stop working when the dev server restarts (the session start resumes them).
 */
export function cookieSecret(env: Record<string, string | undefined> = process.env) {
  const configured = env.PRINT_USER_COOKIE_SECRET;
  if (configured && configured.length >= 32) {
    return configured;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable PRINT_USER_COOKIE_SECRET (32+ characters)");
  }
  devSecret ??= randomBytes(32).toString("hex");
  return devSecret;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signGuestCookie(principal: GuestPrincipal, secret: string) {
  const payload = [VERSION, principal.id, principal.shopId, Math.floor(principal.expiresAt / 1000)].join(".");
  return `${payload}.${sign(payload, secret)}`;
}

/** The guest named by a valid cookie, or null for a missing, tampered or expired one. */
export function verifyGuestCookie(value: string | undefined, secret: string, nowMs = Date.now()): GuestPrincipal | null {
  const parts = value?.split(".") ?? [];
  // Everything before the hmac is signed: 4 fields in v2, 5 in v1 (whose IP tag is not checked).
  const signedFields =
    parts[0] === VERSION && parts.length === 5 ? 4 : parts[0] === LEGACY_VERSION && parts.length === 6 ? 5 : 0;
  if (!signedFields) {
    return null;
  }
  const [, id, shopId, expires] = parts;
  const expected = Buffer.from(sign(parts.slice(0, signedFields).join("."), secret));
  const given = Buffer.from(parts[signedFields]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  const expiresAt = Number(expires) * 1000;
  if (!id || !shopId || !Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    return null;
  }
  return { id, shopId, expiresAt };
}

/** True when a still-valid cookie is old enough to re-issue with a later expiry. */
export function shouldReissueCookie(principal: GuestPrincipal, ttlMs: number, nowMs = Date.now()) {
  return principal.expiresAt - nowMs < ttlMs - COOKIE_REFRESH_MS;
}
