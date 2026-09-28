import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { recordDocumentAccess } from "@/src/modules/documents/document.service";
import { runShopOrder } from "@/src/modules/orders/order-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; docId: string }> };
const ACCESS_TYPES = new Set(["DOWNLOADED", "PREVIEWED", "SPOOLED_TO_PRINTER", "SHREDDED"]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, docId } = await context.params;
    const body = (await request.json().catch(() => undefined)) as { accessType?: string } | undefined;
    const accessType = body?.accessType ?? "";
    if (!ACCESS_TYPES.has(accessType)) {
      throw new AuthServiceError(
        400,
        "accessType must be DOWNLOADED, PREVIEWED, SPOOLED_TO_PRINTER, or SHREDDED",
      );
    }

    return runShopOrder(request, shopId, (user) =>
      recordDocumentAccess(
        user,
        orderId,
        docId,
        accessType as "DOWNLOADED" | "PREVIEWED" | "SPOOLED_TO_PRINTER" | "SHREDDED",
        request,
      ),
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
