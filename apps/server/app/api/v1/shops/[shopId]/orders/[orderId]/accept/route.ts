import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { touchAgentActivity } from "@/src/modules/devices/device.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { acceptShopOrder } from "@/src/modules/orders/order.service";
import { queueIncomingOrder } from "@/src/modules/printing/print-job.service";
import { getShopConfig } from "@/src/modules/shops/shop-config.service";
import { parseBody } from "@/src/modules/shops/shop-route";
import { acceptOrderRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId } = await context.params;
    const body = await parseBody(request, acceptOrderRequestSchema);
    return runShopOrder(request, shopId, async (user) => {
      const { order, accepted } = await acceptShopOrder(user, orderId, body);
      // A replayed accept must not queue a second set of jobs.
      if (accepted && (await getShopConfig(user)).orderAutomation.autoDispatchAcceptedOrders) {
        // The accepting PC's printers are tried first (TRAFFIC_SCALING_V2 6.5).
        await queueIncomingOrder(user, orderId, { preferAgentId: body.agentId });
      }
      if (body.agentId) {
        await touchAgentActivity(user.shopId, body.agentId);
      }
      return order;
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
