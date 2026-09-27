import { jsonResponse, readJsonBody } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import type { AuthSessionUser } from "@ctrlp/types";

type RequestSchema<T> = {
  safeParse: (data: unknown) =>
    | { success: true; data: T }
    | { success: false; error: { issues: Array<{ message: string }> } };
};

export async function shopParams(context: { params: Promise<{ shopId: string }> }) {
  const params = await context.params;
  return params.shopId;
}

export async function withOwnShop(
  request: Request,
  shopId: string,
  action: (user: AuthSessionUser) => Promise<unknown>,
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

export async function parseBody<T>(request: Request, schema: RequestSchema<T>) {
  const parsed = schema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AuthServiceError(400, first?.message ?? "invalid request");
  }

  return parsed.data;
}
