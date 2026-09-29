import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { requireAgentCredential } from "@/src/modules/devices/device.service";
import { confirmDocumentShredded } from "@/src/modules/documents/document.service";
import { runShopOrder } from "@/src/modules/orders/order-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; docId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, docId } = await context.params;
    if (request.headers.has("x-ctrlp-agent-key")) {
      const agentId = request.headers.get("x-ctrlp-agent-id");
      if (!agentId) {
        return Response.json({ error: "AGENT_ID_REQUIRED" }, { status: 401 });
      }
      await requireAgentCredential(request, shopId, agentId);
      return Response.json(
        await confirmDocumentShredded({ id: agentId, shopId } as never, orderId, docId, request),
      );
    }
    return runShopOrder(request, shopId, (user) =>
      confirmDocumentShredded(user, orderId, docId, request),
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
