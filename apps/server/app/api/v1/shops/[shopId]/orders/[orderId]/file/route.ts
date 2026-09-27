import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import { readSinglePagePrintFile } from "@/src/modules/orders/order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId } = await context.params;
    const user = await readAuthorizedShopUser(request);

    if (user.shopId !== shopId) {
      throw new AuthServiceError(403, "shop does not match this account");
    }

    const file = await readSinglePagePrintFile(user, orderId);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
