import { jsonResponse } from "@/src/lib/http";
import { requestRoute, runInRequestContext } from "@/src/lib/request-context";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { readShopPrincipal } from "@/src/modules/auth/require-request";
import type { ShopPrincipal } from "@ctrlp/types";

export async function runShopOrder<T>(
  request: Request,
  shopId: string,
  action: (user: ShopPrincipal) => Promise<T>,
) {
  return runInRequestContext(requestRoute(request), async () => {
    try {
      const user = await readShopPrincipal(request);

      if (user.shopId !== shopId) {
        throw new AuthServiceError(403, "shop does not match this account");
      }

      return jsonResponse(await action(user));
    } catch (error) {
      return authErrorResponse(error);
    }
  });
}
