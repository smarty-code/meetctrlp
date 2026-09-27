import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { confirmDocumentShredded } from "@/src/modules/documents/document.service";
import { runShopOrder } from "@/src/modules/orders/order-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; docId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, docId } = await context.params;
    return runShopOrder(request, shopId, (user) =>
      confirmDocumentShredded(user, orderId, docId, request),
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
