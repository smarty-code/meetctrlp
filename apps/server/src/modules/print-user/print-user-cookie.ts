import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Signed guest cookie (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.8). It names the guest, their shop and
// when the session ends, bound to their network, so a request is authorized with no Firestore read.
// Format: v1.<printUserId>.<shopId>.<expiresAtEpochSeconds>.<ipHash>.<hmac>

const VERSION = "v1";
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

/** A short, non-reversible tag of the client IP: the cookie only works from the network it was issued to. */
export function ipTag(ipAddress: string) {
  return createHash("sha256").update(ipAddress).digest("base64url").slice(0, 16);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signGuestCookie(principal: GuestPrincipal, ipAddress: string, secret: string) {
  const payload = [VERSION, principal.id, principal.shopId, Math.floor(principal.expiresAt / 1000), ipTag(ipAddress)].join(".");
  return `${payload}.${sign(payload, secret)}`;
}

/** The guest named by a valid cookie, or null for a missing, tampered, expired or foreign-network one. */
export function verifyGuestCookie(value: string | undefined, ipAddress: string, secret: string, nowMs = Date.now()): GuestPrincipal | null {
  const parts = value?.split(".") ?? [];
  if (parts.length !== 6 || parts[0] !== VERSION) {
    return null;
  }
  const [, id, shopId, expires, ip, mac] = parts;
  const expected = Buffer.from(sign(parts.slice(0, 5).join("."), secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  const expiresAt = Number(expires) * 1000;
  if (!id || !shopId || !Number.isFinite(expiresAt) || expiresAt <= nowMs || ip !== ipTag(ipAddress)) {
    return null;
  }
  return { id, shopId, expiresAt };
}

/** True when a still-valid cookie is old enough to re-issue with a later expiry. */
export function shouldReissueCookie(principal: GuestPrincipal, ttlMs: number, nowMs = Date.now()) {
  return principal.expiresAt - nowMs < ttlMs - COOKIE_REFRESH_MS;
}
