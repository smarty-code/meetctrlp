import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { updatePrinterConfig, updatePrinterPreset } from "@/src/modules/printing/print-job.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { updatePrinterConfigRequestSchema, updatePrinterPresetRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; printerId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { shopId, printerId } = await context.params;
    const body = await parseBody(request, updatePrinterPresetRequestSchema);
    return runShopOrder(request, shopId, (user) => updatePrinterPreset(user, printerId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { shopId, printerId } = await context.params;
    const body = await parseBody(request, updatePrinterConfigRequestSchema);
    return runShopOrder(request, shopId, (user) => updatePrinterConfig(user, printerId, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
