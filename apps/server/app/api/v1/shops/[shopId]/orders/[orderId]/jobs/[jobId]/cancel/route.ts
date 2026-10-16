import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { cancelPrintJob } from "@/src/modules/printing/print-job.service";
import { parseBody } from "@/src/modules/shops/shop-route";
import { cancelPrintJobRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; jobId: string }> };

/** The operator cancels a waiting, failed, or stuck job. Its PC drops it on the next sync. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, jobId } = await context.params;
    const body = await parseBody(request, cancelPrintJobRequestSchema);
    return runShopOrder(request, shopId, (user) => cancelPrintJob(user, orderId, jobId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
