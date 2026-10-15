import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { reportAgentJobs } from "@/src/modules/printing/agent-sync.service";
import { parseBody } from "@/src/modules/shops/shop-route";
import { reportAgentJobsRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; agentId: string }> };

/** Final job results from the agent's outbox. Always 200 with a result per report (6.3). */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, agentId } = await context.params;
    const body = await parseBody(request, reportAgentJobsRequestSchema);
    return runShopOrder(request, shopId, (user) => reportAgentJobs(user, agentId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
