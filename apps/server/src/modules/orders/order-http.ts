import { jsonResponse } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import type { AuthSessionUser } from "@ctrlp/types";

export async function runShopOrder<T>(
  request: Request,
  shopId: string,
  action: (user: AuthSessionUser) => Promise<T>,
) {
  try {
    const user = await readAuthorizedShopUser(request);

    if (user.shopId !== shopId) {
      throw new AuthServiceError(403, "shop does not match this account");
    }

    return jsonResponse(await action(user));
  } catch (error) {
    return authErrorResponse(error);
  }
}
