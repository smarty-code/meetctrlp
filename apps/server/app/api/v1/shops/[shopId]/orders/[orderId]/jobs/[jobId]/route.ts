import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { updatePrintJob } from "@/src/modules/printing/print-job.service";
import { parseBody } from "@/src/modules/shops/shop-route";
import { updatePrintJobRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; jobId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, jobId } = await context.params;
    const body = await parseBody(request, updatePrintJobRequestSchema);
    return runShopOrder(request, shopId, (user) => updatePrintJob(user, orderId, jobId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
