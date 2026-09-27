import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { rejectShopOrder } from "@/src/modules/orders/order.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { rejectOrderRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId } = await context.params;
    const body = await parseBody(request, rejectOrderRequestSchema);
    return runShopOrder(request, shopId, (user) => rejectShopOrder(user, orderId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
