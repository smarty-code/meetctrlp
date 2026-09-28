import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { dispatchPrintJob, listOrderPrintJobs } from "@/src/modules/printing/print-job.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { dispatchPrintJobRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId } = await context.params;
    return runShopOrder(request, shopId, (user) => listOrderPrintJobs(user, orderId));
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId } = await context.params;
    const body = await parseBody(request, dispatchPrintJobRequestSchema);
    return runShopOrder(request, shopId, (user) => dispatchPrintJob(user, orderId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
