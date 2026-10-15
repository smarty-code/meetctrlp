import { timingSafeEqual } from "node:crypto";

import { jsonResponse } from "@/src/lib/http";
import { requestRoute, runInRequestContext } from "@/src/lib/request-context";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { systemPrincipal } from "@/src/modules/auth/principal";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { confirmOnlinePayment } from "@/src/modules/orders/order.service";
import { queueIncomingOrder } from "@/src/modules/printing/print-job.service";
import { getShopConfig } from "@/src/modules/shops/shop-config.service";
import { confirmOnlinePaymentRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string }> };

function requirePaymentWebhook(request: Request) {
  const expected = process.env.CTRLP_PAYMENT_WEBHOOK_SECRET;
  const supplied = request.headers.get("x-ctrlp-payment-secret");
  if (!expected || !supplied) throw new AuthServiceError(401, "PAYMENT_WEBHOOK_UNAUTHORIZED");
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    throw new AuthServiceError(401, "PAYMENT_WEBHOOK_UNAUTHORIZED");
  }
}

export async function POST(request: Request, context: RouteContext) {
  return runInRequestContext(requestRoute(request), () => confirm(request, context));
}

async function confirm(request: Request, context: RouteContext) {
  try {
    requirePaymentWebhook(request);
    const { shopId, orderId } = await context.params;
    const body = confirmOnlinePaymentRequestSchema.parse(await request.json());
    const result = await confirmOnlinePayment(shopId, orderId, body);
    if (result.autoAccepted && (await getShopConfig(systemPrincipal(shopId, "payment-provider"))).orderAutomation.autoDispatchAcceptedOrders) {
      await queueIncomingOrder(systemPrincipal(shopId, "payment-provider"), orderId);
    }
    return jsonResponse(result.order);
  } catch (error) {
    return authErrorResponse(error);
  }
}
