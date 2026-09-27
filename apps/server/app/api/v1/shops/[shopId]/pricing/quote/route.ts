import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import { quoteShopDocument } from "@/src/modules/shops/shop-config.service";
import { parseBody, shopParams } from "@/src/modules/shops/shop-route";
import { priceQuoteRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const shopId = await shopParams(context);
    const user = await readAuthorizedShopUser(request);

    if (user.shopId !== shopId) {
      throw new AuthServiceError(403, "shop does not match this account");
    }

    const body = await parseBody(request, priceQuoteRequestSchema);
    return jsonResponse(await quoteShopDocument(user, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
