import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { recordCashPayment } from "@/src/modules/orders/order.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { recordCashPaymentRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId } = await context.params;
    const body = await parseBody(request, recordCashPaymentRequestSchema);
    return runShopOrder(request, shopId, (user) => recordCashPayment(user, orderId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
