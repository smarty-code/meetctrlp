import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { syncAgent } from "@/src/modules/printing/agent-sync.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; agentId: string }> };

/** The agent calls this when its doorbell's `workAt` changes (TRAFFIC_SCALING_V2 6.3). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, agentId } = await context.params;
    const origin = new URL(request.url).origin;
    return runShopOrder(request, shopId, (user) => syncAgent(user, agentId, origin));
  } catch (error) {
    return authErrorResponse(error);
  }
}
