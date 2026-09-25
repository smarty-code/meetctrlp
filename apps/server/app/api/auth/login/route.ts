import { jsonResponse, readJsonBody } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { loginShopUser } from "@/src/modules/auth/auth.service";
import { loginRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = loginRequestSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AuthServiceError(400, first?.message ?? "invalid request");
    }

    return jsonResponse(await loginShopUser(parsed.data));
  } catch (error) {
    return authErrorResponse(error);
  }
}
