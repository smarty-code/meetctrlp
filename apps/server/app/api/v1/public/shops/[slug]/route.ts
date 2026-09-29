import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { getPublicShopBySlug } from "@/src/modules/print-user/print-user-shop.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const shop = await getPublicShopBySlug(slug);
    if (!shop) {
      throw new AuthServiceError(404, "shop not found");
    }
    return jsonResponse({ shop });
  } catch (error) {
    return authErrorResponse(error);
  }
}
