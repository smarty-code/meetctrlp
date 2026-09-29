import { acceptShopOrder } from "@/src/modules/orders/order.service";
import { queueIncomingOrder } from "@/src/modules/printing/print-job.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { orderTransitionRequestSchema } from "@ctrlp/schemas";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { getShopConfig } from "@/src/modules/shops/shop-config.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId } = await context.params;
    const body = await parseBody(request, orderTransitionRequestSchema);
    return runShopOrder(request, shopId, async (user) => {
      const order = await acceptShopOrder(user, orderId, body);
      if ((await getShopConfig(user)).orderAutomation.autoDispatchAcceptedOrders) {
        await queueIncomingOrder(user, orderId);
      }
      return order;
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
