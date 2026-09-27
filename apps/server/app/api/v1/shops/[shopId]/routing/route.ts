import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { routePrintJob } from "@/src/modules/printing/print-job.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { routePrintJobRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    const body = await parseBody(request, routePrintJobRequestSchema);
    return runShopOrder(request, shopId, (user) => routePrintJob(user, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
