import { FirebaseAuthRestError } from "@ctrlp/firebase";

export class AuthServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
  }
}

export function isMissingEnvError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.startsWith("Missing required environment variable") ||
      error.message.startsWith("Firebase configuration is incomplete"))
  );
}

function postgresCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code);
  }

  return undefined;
}

export function isUniqueViolation(error: unknown, fragment?: string) {
  if (postgresCode(error) !== "23505") {
    return false;
  }

  if (!fragment) {
    return true;
  }

  const constraint =
    error && typeof error === "object"
      ? "constraint_name" in error
        ? String(error.constraint_name)
        : "constraint" in error
          ? String(error.constraint)
          : ""
      : "";
  const message = error instanceof Error ? error.message : "";
  return (
    constraint.toLowerCase().includes(fragment.toLowerCase()) ||
    message.toLowerCase().includes(fragment.toLowerCase())
  );
}

export function mapFirebaseAuthError(error: unknown): AuthServiceError | undefined {
  if (!(error instanceof FirebaseAuthRestError)) {
    return undefined;
  }

  switch (error.code) {
    case "EMAIL_EXISTS":
      return new AuthServiceError(409, "an account with this email already exists");
    case "EMAIL_NOT_FOUND":
    case "INVALID_PASSWORD":
    case "INVALID_LOGIN_CREDENTIALS":
    case "USER_NOT_FOUND":
    case "INVALID_ID_TOKEN":
    case "INVALID_REFRESH_TOKEN":
    case "TOKEN_EXPIRED":
      return new AuthServiceError(401, "invalid credentials");
    case "USER_DISABLED":
      return new AuthServiceError(403, "account is not active");
    case "WEAK_PASSWORD":
      return new AuthServiceError(400, "password is too weak");
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return new AuthServiceError(429, "too many attempts, try again later");
    default:
      return new AuthServiceError(502, "authentication provider error");
  }
}

export function mapFirebaseAdminError(error: unknown): AuthServiceError | undefined {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : undefined;

  if (!code) {
    return undefined;
  }

  if (
    code === "auth/phone-number-already-exists" ||
    code === "auth/email-already-exists"
  ) {
    return new AuthServiceError(409, "an account with these details already exists");
  }

  if (
    code === "app/invalid-credential" ||
    code === "auth/invalid-credential"
  ) {
    return new AuthServiceError(
      503,
      "Firebase Admin credentials are invalid or this machine's clock is out of sync with Google",
    );
  }

  if (
    code === "auth/id-token-expired" ||
    code === "auth/id-token-revoked" ||
    code === "auth/argument-error" ||
    code === "auth/invalid-id-token"
  ) {
    return new AuthServiceError(401, "unauthorized");
  }

  return undefined;
}
