import { jsonResponse } from "@/src/lib/http";
import { getHealthStatus } from "@/src/modules/health/health.service";

export const runtime = "nodejs";

export function GET() {
  return jsonResponse(getHealthStatus());
}