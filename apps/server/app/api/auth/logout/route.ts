import { getBearerToken, jsonResponse, readJsonBody } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { logoutShopUser } from "@/src/modules/auth/auth.service";
import { logoutRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      throw new AuthServiceError(401, "unauthorized");
    }

    // An empty body is fine: it means "this device only".
    const body = logoutRequestSchema.safeParse((await readJsonBody(request)) ?? {});

    if (!body.success) {
      throw new AuthServiceError(400, body.error.issues[0]?.message ?? "invalid request");
    }

    await logoutShopUser(token, { allDevices: body.data.allDevices });
    return jsonResponse({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
