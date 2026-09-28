import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { listShopPrinters, syncShopPrinters } from "@/src/modules/printing/print-job.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { syncPrintersRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    return runShopOrder(request, shopId, (user) => listShopPrinters(user));
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    const body = await parseBody(request, syncPrintersRequestSchema);
    return runShopOrder(request, shopId, (user) => syncShopPrinters(user, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
