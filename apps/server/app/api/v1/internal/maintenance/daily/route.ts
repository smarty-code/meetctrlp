import { timingSafeEqual } from "node:crypto";

import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { runDailyMaintenance } from "@/src/modules/maintenance/maintenance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A bounded run, but give it room on a cold instance.
export const maxDuration = 300;

function matches(expected: string | undefined, supplied: string | null | undefined) {
  if (!expected || !supplied) {
    return false;
  }
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Two ways in: `x-ctrlp-maintenance-secret: <CTRLP_MAINTENANCE_SECRET>` (any scheduler, or by hand),
 * or `Authorization: Bearer <CRON_SECRET>`, which Vercel Cron sends.
 */
function requireMaintenanceSecret(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const allowed =
    matches(process.env.CTRLP_MAINTENANCE_SECRET, request.headers.get("x-ctrlp-maintenance-secret")) ||
    matches(process.env.CRON_SECRET, bearer);
  if (!allowed) {
    throw new AuthServiceError(401, "MAINTENANCE_UNAUTHORIZED");
  }
}

async function run(request: Request) {
  try {
    requireMaintenanceSecret(request);
    return jsonResponse(await runDailyMaintenance());
  } catch (error) {
    return authErrorResponse(error);
  }
}

/** Daily clean-up (TRAFFIC_SCALING_V2 6.10). Vercel Cron calls GET; other schedulers may POST. */
export const GET = run;
export const POST = run;
