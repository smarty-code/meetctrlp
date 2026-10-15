import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { getCurrentShopUser } from "@/src/modules/auth/auth.service";
import { readShopPrincipal } from "@/src/modules/auth/require-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentShopUser(await readShopPrincipal(request));
    return jsonResponse({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
