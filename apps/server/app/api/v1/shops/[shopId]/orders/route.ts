import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { createShopOrder, listShopOrders } from "@/src/modules/orders/order.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { checkoutOrderRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { shopId } = await context.params;
  return runShopOrder(request, shopId, (user) => listShopOrders(user));
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
