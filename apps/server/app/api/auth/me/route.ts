import { getBearerToken, jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { requireShopUser } from "@/src/modules/auth/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      throw new AuthServiceError(401, "unauthorized");
    }

    const user = await requireShopUser(token);
    return jsonResponse({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
