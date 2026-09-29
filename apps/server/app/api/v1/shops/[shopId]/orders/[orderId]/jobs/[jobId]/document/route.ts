import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { requireAgentCredential } from "@/src/modules/devices/device.service";
import { createDocumentDownloadUrl } from "@/src/modules/documents/document.service";
import { getFirebaseFirestore } from "@ctrlp/firebase/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; jobId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, jobId } = await context.params;
    const agentId = request.headers.get("x-ctrlp-agent-id");
    if (!agentId) {
      return Response.json({ error: "AGENT_ID_REQUIRED" }, { status: 401 });
    }
    await requireAgentCredential(request, shopId, agentId);
    const job = await getFirebaseFirestore().doc(`shops/${shopId}/orders/${orderId}/printJobs/${jobId}`).get();
    if (!job.exists || job.get("agentId") !== agentId || job.get("status") !== "DISPATCHING") {
      return Response.json({ error: "PRINT_JOB_NOT_LEASED" }, { status: 409 });
    }
    return Response.json(await createDocumentDownloadUrl(
      { id: agentId, shopId } as never,
      orderId,
      String(job.get("documentId")),
      new URL(request.url).origin,
    ));
  } catch (error) {
    return authErrorResponse(error);
  }
}
