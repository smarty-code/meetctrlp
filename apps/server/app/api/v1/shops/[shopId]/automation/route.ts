import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import { getShopConfig, updateOrderAutomation } from "@/src/modules/shops/shop-config.service";
import { parseBody, shopParams } from "@/src/modules/shops/shop-route";
import { updateOrderAutomationRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const shopId = await shopParams(context);
    const user = await readAuthorizedShopUser(request);
    if (user.shopId !== shopId) throw new AuthServiceError(403, "shop does not match this account");
    return jsonResponse((await getShopConfig(user)).orderAutomation);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const shopId = await shopParams(context);
    const user = await readAuthorizedShopUser(request);
    if (user.shopId !== shopId) throw new AuthServiceError(403, "shop does not match this account");
    return jsonResponse(await updateOrderAutomation(
      user,
      await parseBody(request, updateOrderAutomationRequestSchema),
    ));
  } catch (error) {
    return authErrorResponse(error);
  }
}
