import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { listOrderHistory } from "@/src/modules/orders/board.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { createShopOrder } from "@/src/modules/orders/order.service";
import { parseBody, parseQuery } from "@/src/modules/shops/shop-route";
import { checkoutOrderRequestSchema, orderHistoryQuerySchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

/** Paged history: `?status=A,B&from=YYYY-MM-DD&to=YYYY-MM-DD&cursor=&limit=` (TRAFFIC_SCALING_V2 6.4). */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    const query = parseQuery(request, orderHistoryQuerySchema);
    return runShopOrder(request, shopId, (user) => listOrderHistory(user, query));
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    const body = await parseBody(request, checkoutOrderRequestSchema);
    return runShopOrder(request, shopId, (user) => createShopOrder(user, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
