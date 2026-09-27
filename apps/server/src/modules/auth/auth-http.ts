import { jsonResponse } from "@/src/lib/http";
import {
  AuthServiceError,
  isMissingEnvError,
  mapFirebaseAdminError,
} from "@/src/modules/auth/auth.errors";

const CLOCK_MESSAGE =
  "Firebase rejected the server credentials. Set this PC's clock to the correct local time, sync it with the internet, then restart the server.";

function isStaleGoogleCredential(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const value = error as {
    code?: unknown;
    reason?: unknown;
    message?: string;
    details?: string;
  };
  const code = value.code === undefined ? "" : String(value.code);
  const reason = value.reason === undefined ? "" : String(value.reason);
  const text = `${value.message ?? ""} ${value.details ?? ""}`;

  return (
    code === "16" ||
    reason === "ACCESS_TOKEN_EXPIRED" ||
    text.includes("invalid_grant") ||
    text.includes("ACCESS_TOKEN_EXPIRED") ||
    text.includes("Invalid JWT")
  );
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthServiceError) {
    return jsonResponse({ error: error.message }, { status: error.status });
  }

  const mapped = mapFirebaseAdminError(error);

  if (mapped) {
    console.error(error);
    return jsonResponse({ error: mapped.message }, { status: mapped.status });
  }

  if (isStaleGoogleCredential(error)) {
    console.error(error);
    return jsonResponse({ error: CLOCK_MESSAGE }, { status: 503 });
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
