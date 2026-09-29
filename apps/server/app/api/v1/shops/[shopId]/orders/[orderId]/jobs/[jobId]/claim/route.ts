import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { requireAgentCredential } from "@/src/modules/devices/device.service";
import { claimPrintJob } from "@/src/modules/printing/print-job.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { claimPrintJobRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, jobId } = await context.params;
    const body = await parseBody(request, claimPrintJobRequestSchema);
    if (request.headers.has("x-ctrlp-agent-key")) {
      await requireAgentCredential(request, shopId, body.agentId);
      return Response.json(await claimPrintJob({ id: body.agentId, shopId } as never, orderId, jobId, body));
    }
    return runShopOrder(request, shopId, (user) => claimPrintJob(user, orderId, jobId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
