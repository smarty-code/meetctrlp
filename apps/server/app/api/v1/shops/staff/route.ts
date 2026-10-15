import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { readShopPrincipal } from "@/src/modules/auth/require-request";
import { listActiveShopStaff } from "@/src/modules/shops/shop-profile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await readShopPrincipal(request);
    return jsonResponse(await listActiveShopStaff(user));
  } catch (error) {
    return authErrorResponse(error);
  }
}
