import { getBearerToken, jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { logoutShopUser } from "@/src/modules/auth/auth.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      throw new AuthServiceError(401, "unauthorized");
    }

    await logoutShopUser(token);
    return jsonResponse({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
