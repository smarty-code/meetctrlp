import { getShopOrder } from "@/src/modules/orders/order.service";
import { runShopOrder } from "@/src/modules/orders/order-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { shopId, orderId } = await context.params;
  return runShopOrder(request, shopId, (user) => getShopOrder(user, orderId));
}
