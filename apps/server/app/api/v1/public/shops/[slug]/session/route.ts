import { createCustomToken } from "@ctrlp/firebase";

import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { isShopAcceptingOrders } from "@/src/modules/print-user/print-user.helpers";
import { readClientIp, readGuestPrincipal, writePrintUserCookie } from "@/src/modules/print-user/print-user-http";
import { createOrResumePrintUserSession, toPublicSession } from "@/src/modules/print-user/print-user-session.service";
import { getPublicShopBySlug } from "@/src/modules/print-user/print-user-shop.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/** Lets the tracking page read `orderTracking` live. Without it the page falls back to one-off fetches. */
async function guestFirebaseToken(printUserId: string) {
  try {
    return await createCustomToken(printUserId);
  } catch (error) {
    console.error("Failed to sign a guest Firebase token", error);
    return null;
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const shop = await getPublicShopBySlug(slug);
    if (!shop) {
      throw new AuthServiceError(404, "shop not found");
    }
    if (!isShopAcceptingOrders(shop.shopStatus)) {
      throw new AuthServiceError(409, "this shop is not accepting orders");
    }

    const session = await createOrResumePrintUserSession({
      shopId: shop.id,
      shopSlug: shop.slug,
      ipAddress: readClientIp(request),
      cookiePrintUserId: (await readGuestPrincipal(request))?.id,
    });
    await writePrintUserCookie(session, request);
    return jsonResponse({ session: toPublicSession(session), shop, firebaseToken: await guestFirebaseToken(session.id) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
