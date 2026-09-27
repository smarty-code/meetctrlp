import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import { getShopConfig, updateShopPricing } from "@/src/modules/shops/shop-config.service";
import { parseBody, shopParams, withOwnShop } from "@/src/modules/shops/shop-route";
import { updateShopPricingRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return withOwnShop(request, await shopParams(context), (user) => getShopConfig(user));
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const shopId = await shopParams(context);
    const user = await readAuthorizedShopUser(request);

    if (user.shopId !== shopId) {
      throw new AuthServiceError(403, "shop does not match this account");
    }

    const body = await parseBody(request, updateShopPricingRequestSchema);
    return jsonResponse(await updateShopPricing(user, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
