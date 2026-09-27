import { jsonResponse, readJsonBody } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import { recordDeviceHeartbeat } from "@/src/modules/devices/device.service";
import { deviceHeartbeatRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await readAuthorizedShopUser(request);
    const parsed = deviceHeartbeatRequestSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AuthServiceError(400, first?.message ?? "invalid request");
    }

    return jsonResponse(await recordDeviceHeartbeat(user, parsed.data));
  } catch (error) {
    return authErrorResponse(error);
  }
}
