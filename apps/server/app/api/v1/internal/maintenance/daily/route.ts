import { timingSafeEqual } from "node:crypto";

import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { runDailyMaintenance } from "@/src/modules/maintenance/maintenance.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireMaintenanceSecret(request: Request) {
  const expected = process.env.CTRLP_MAINTENANCE_SECRET;
  const supplied = request.headers.get("x-ctrlp-maintenance-secret");
  if (!expected || !supplied) {
    throw new AuthServiceError(401, "MAINTENANCE_UNAUTHORIZED");
  }
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new AuthServiceError(401, "MAINTENANCE_UNAUTHORIZED");
  }
}

/** Daily clean-up, called by Cloud Scheduler with the shared secret (TRAFFIC_SCALING_V2 6.10). */
export async function POST(request: Request) {
  try {
    requireMaintenanceSecret(request);
    return jsonResponse(await runDailyMaintenance());
  } catch (error) {
    return authErrorResponse(error);
  }
}
