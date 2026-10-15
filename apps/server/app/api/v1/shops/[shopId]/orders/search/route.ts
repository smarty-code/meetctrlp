import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { searchOrders } from "@/src/modules/orders/board.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseQuery } from "@/src/modules/shops/shop-route";
import { orderSearchQuerySchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

/** `?q=` matches order number, pickup code, phone digits or a filename word (3+ characters). */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    const query = parseQuery(request, orderSearchQuerySchema);
    return runShopOrder(request, shopId, (user) => searchOrders(user, query));
  } catch (error) {
    return authErrorResponse(error);
  }
}
