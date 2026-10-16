import { cookies } from "next/headers";

import { jsonResponse } from "@/src/lib/http";
import { requestRoute, runInRequestContext } from "@/src/lib/request-context";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import {
  cookieSecret,
  shouldReissueCookie,
  signGuestCookie,
  verifyGuestCookie,
  type GuestPrincipal,
} from "@/src/modules/print-user/print-user-cookie";
import {
  PRINT_USER_COOKIE,
  SESSION_TTL_MS,
  clientIpFromHeaders,
  sessionCookieOptions,
} from "@/src/modules/print-user/print-user.helpers";
import { extendPrintUserSession } from "@/src/modules/print-user/print-user-session.service";

export type { GuestPrincipal };

/** The visitor's IP, recorded on a new session for abuse logging. It never identifies the guest. */
export function readClientIp(request: Request) {
  return clientIpFromHeaders(request.headers, process.env.CTRLP_PROXY_SECRET);
}

export async function readPrintUserCookie() {
  const jar = await cookies();
  return jar.get(PRINT_USER_COOKIE)?.value;
}

/** The guest a signed cookie names, or null. Never reads Firestore. */
export async function readGuestPrincipal() {
  return verifyGuestCookie(await readPrintUserCookie(), cookieSecret());
}

/** Issues the signed session cookie for this guest. */
export async function writePrintUserCookie(session: { id: string; shopId: string; expiresAt: string | number | null }) {
  const expiresAt = typeof session.expiresAt === "number"
    ? session.expiresAt
    : session.expiresAt
      ? Date.parse(session.expiresAt)
      : Date.now() + SESSION_TTL_MS;
  const jar = await cookies();
  jar.set(
    PRINT_USER_COOKIE,
    signGuestCookie({ id: session.id, shopId: session.shopId, expiresAt }, cookieSecret()),
    sessionCookieOptions(process.env.NODE_ENV === "production"),
  );
}

/** The guest calling, from the signed cookie with no read (TRAFFIC_SCALING_V2 6.8). 401 when absent. */
export async function requirePrintUserSession(): Promise<GuestPrincipal> {
  const guest = await readGuestPrincipal();
  if (!guest) {
    throw new AuthServiceError(401, "guest session required");
  }
  return guest;
}

/**
 * Sliding expiry, at most once an hour: a later cookie, and the same expiry on the session document
 * so the daily clean-up keeps it. Best effort; the current cookie stays valid if this fails.
 */
async function slideSession(guest: GuestPrincipal) {
  if (!shouldReissueCookie(guest, SESSION_TTL_MS)) {
    return;
  }
  const expiresAt = Date.now() + SESSION_TTL_MS;
  try {
    await extendPrintUserSession(guest.id, new Date(expiresAt));
    await writePrintUserCookie({ id: guest.id, shopId: guest.shopId, expiresAt });
  } catch (error) {
    console.error("Failed to extend the guest session", guest.id, error);
  }
}

export async function runPrintUser(
  request: Request,
  action: (guest: GuestPrincipal) => Promise<unknown>,
) {
  return runInRequestContext(requestRoute(request), async () => {
    try {
      const guest = await requirePrintUserSession();
      const result = await action(guest);
      await slideSession(guest);
      return jsonResponse(result);
    } catch (error) {
      return authErrorResponse(error);
    }
  });
}
