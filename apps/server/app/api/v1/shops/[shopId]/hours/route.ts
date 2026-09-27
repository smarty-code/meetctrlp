import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import { updateShopHours } from "@/src/modules/shops/shop-config.service";
import { parseBody, shopParams } from "@/src/modules/shops/shop-route";
import { updateShopHoursRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const shopId = await shopParams(context);
    const user = await readAuthorizedShopUser(request);

    if (user.shopId !== shopId) {
      throw new AuthServiceError(403, "shop does not match this account");
    }

    const body = await parseBody(request, updateShopHoursRequestSchema);
    return jsonResponse(await updateShopHours(user, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
