import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import { listActiveShopStaff } from "@/src/modules/shops/shop-profile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await readAuthorizedShopUser(request);
    return jsonResponse(await listActiveShopStaff(user));
  } catch (error) {
    return authErrorResponse(error);
  }
}
