import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { createDocumentDownloadUrl } from "@/src/modules/documents/document.service";
import { runShopOrder } from "@/src/modules/orders/order-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; docId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, docId } = await context.params;
    const origin = new URL(request.url).origin;
    return runShopOrder(request, shopId, (user) =>
      createDocumentDownloadUrl(user, orderId, docId, origin),
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
