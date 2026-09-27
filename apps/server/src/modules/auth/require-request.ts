import { getBearerToken } from "@/src/lib/http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { requireShopUser } from "@/src/modules/auth/auth.service";

export async function readAuthorizedShopUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new AuthServiceError(401, "unauthorized");
  }

  return requireShopUser(token);
}
