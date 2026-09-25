import { jsonResponse, readJsonBody } from "@/src/lib/http";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { registerShopOwner } from "@/src/modules/auth/auth.service";
import { registerRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = registerRequestSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new AuthServiceError(400, first?.message ?? "invalid request");
    }

    const result = await registerShopOwner(parsed.data);
    return jsonResponse(result, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
