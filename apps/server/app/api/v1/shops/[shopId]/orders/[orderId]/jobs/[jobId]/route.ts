import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { requireAgentCredential } from "@/src/modules/devices/device.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { updatePrintJob } from "@/src/modules/printing/print-job.service";
import { parseBody } from "@/src/modules/shops/shop-route";
import { updatePrintJobRequestSchema } from "@ctrlp/schemas";
import { getFirebaseFirestore } from "@ctrlp/firebase/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; jobId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, jobId } = await context.params;
    const body = await parseBody(request, updatePrintJobRequestSchema);
    if (request.headers.has("x-ctrlp-agent-key")) {
      const agentId = request.headers.get("x-ctrlp-agent-id");
      if (!agentId) {
        return Response.json({ error: "AGENT_ID_REQUIRED" }, { status: 401 });
      }
      await requireAgentCredential(request, shopId, agentId);
      const job = await getFirebaseFirestore().doc(`shops/${shopId}/orders/${orderId}/printJobs/${jobId}`).get();
      if (!job.exists || job.get("agentId") !== agentId) {
        return Response.json({ error: "PRINT_JOB_AGENT_MISMATCH" }, { status: 403 });
      }
      return Response.json(await updatePrintJob({ id: agentId, shopId } as never, orderId, jobId, body));
    }
    return runShopOrder(request, shopId, (user) => updatePrintJob(user, orderId, jobId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
