import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { retryPrintJob } from "@/src/modules/printing/print-job.service";
import { parseBody } from "@/src/modules/shops/shop-route";
import { retryPrintJobRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; jobId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, jobId } = await context.params;
    const body = await parseBody(request, retryPrintJobRequestSchema);
    return runShopOrder(request, shopId, (user) => retryPrintJob(user, orderId, jobId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
