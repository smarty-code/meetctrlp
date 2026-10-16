import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { syncAgent } from "@/src/modules/printing/agent-sync.service";
import { parseBody } from "@/src/modules/shops/shop-route";
import { syncAgentRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; agentId: string }> };

/**
 * The agent calls this when its doorbell's `workAt` changes (TRAFFIC_SCALING_V2 6.3). The body may
 * list the leases it holds (`held`); an empty body is accepted, as older agents send `{}`.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, agentId } = await context.params;
    const origin = new URL(request.url).origin;
    const body = await parseBody(request, syncAgentRequestSchema);
    return runShopOrder(request, shopId, (user) => syncAgent(user, agentId, origin, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
