import { jsonResponse } from "@/src/lib/http";
import {
  AuthServiceError,
  isMissingEnvError,
} from "@/src/modules/auth/auth.errors";

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthServiceError) {
    return jsonResponse({ error: error.message }, { status: error.status });
  }

  if (isMissingEnvError(error)) {
    console.error(error);
    return jsonResponse(
      { error: "authentication is not configured" },
      { status: 503 },
    );
  }

  console.error(error);
  return jsonResponse({ error: "internal error" }, { status: 500 });
}
