import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { requireAgentCredential } from "@/src/modules/devices/device.service";
import { listAgentPrintJobs } from "@/src/modules/printing/print-job.service";
import { runShopOrder } from "@/src/modules/orders/order-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; agentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId, agentId } = await context.params;
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? "10");
    if (request.headers.has("x-ctrlp-agent-key")) {
      await requireAgentCredential(request, shopId, agentId);
      return Response.json(await listAgentPrintJobs(
        { id: agentId, shopId } as never,
        { agentId, limit: Number.isInteger(limit) ? limit : 10 },
      ));
    }
    return runShopOrder(request, shopId, (user) =>
      listAgentPrintJobs(user, { agentId, limit: Number.isInteger(limit) ? limit : 10 }),
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
