import { cookies } from "next/headers";

import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import {
  PRINT_USER_COOKIE,
  clientIpFromHeaders,
  sessionCookieOptions,
} from "@/src/modules/print-user/print-user.helpers";
import { requireValidPrintUserSession } from "@/src/modules/print-user/print-user-session.service";
import type { PrintUserSession } from "@/src/modules/print-user/print-user.types";

export function readClientIp(request: Request) {
  return clientIpFromHeaders(request.headers);
}

export async function readPrintUserCookie() {
  const jar = await cookies();
  return jar.get(PRINT_USER_COOKIE)?.value;
}

export async function writePrintUserCookie(printUserId: string) {
  const jar = await cookies();
  jar.set(PRINT_USER_COOKIE, printUserId, sessionCookieOptions(process.env.NODE_ENV === "production"));
}

export async function requirePrintUserSession(request: Request): Promise<PrintUserSession> {
  const printUserId = await readPrintUserCookie();
  if (!printUserId) {
    throw new AuthServiceError(401, "guest session required");
  }
  return requireValidPrintUserSession(printUserId, readClientIp(request));
}

export async function runPrintUser(
  request: Request,
  action: (session: PrintUserSession) => Promise<unknown>,
) {
  try {
    const session = await requirePrintUserSession(request);
    return jsonResponse(await action(session));
  } catch (error) {
    return authErrorResponse(error);
  }
}
