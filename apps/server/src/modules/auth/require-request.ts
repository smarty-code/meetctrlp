import { getBearerToken } from "@/src/lib/http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { requireShopPrincipal } from "@/src/modules/auth/auth.service";

export async function readShopPrincipal(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new AuthServiceError(401, "unauthorized");
  }

  return requireShopPrincipal(token);
}
