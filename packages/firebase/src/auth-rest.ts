import { getFirebaseWebApiKey } from "./config.js";

export const FIREBASE_PHONE_EMAIL_DOMAIN = "phone.meetctrlp.app";

export class FirebaseAuthRestError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "FirebaseAuthRestError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type FirebasePasswordAuthResult = {
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  localId: string;
  email: string;
};

type IdentityToolkitErrorBody = {
  error?: {
    message?: string;
    code?: number;
  };
};

type IdentityToolkitSignInBody = {
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  localId?: string;
  email?: string;
};

type SecureTokenBody = {
  id_token?: string;
  refresh_token?: string;
  expires_in?: string;
  user_id?: string;
};

function parseIdentityToolkitError(payload: IdentityToolkitErrorBody, status: number) {
  const raw = payload.error?.message ?? "FIREBASE_AUTH_ERROR";
  const code = raw.split(":")[0]?.trim() || "FIREBASE_AUTH_ERROR";
  return new FirebaseAuthRestError(code, raw, status);
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function isInternalPhoneEmail(email: string) {
  return email.toLowerCase().endsWith(`@${FIREBASE_PHONE_EMAIL_DOMAIN}`);
}

export function looksLikeEmail(value: string) {
  return value.includes("@");
}

export function normalizePhoneNumber(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    if (digits.length < 8 || digits.length > 15) {
      return null;
    }

    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export function phoneToFirebaseEmail(e164: string) {
  const digits = e164.replace(/\D/g, "");

  if (!digits) {
    throw new Error("Phone number has no digits");
  }

  return `${digits}@${FIREBASE_PHONE_EMAIL_DOMAIN}`;
}

async function postIdentityToolkit(
  path: string,
  body: Record<string, unknown>,
): Promise<IdentityToolkitSignInBody> {
  const key = getFirebaseWebApiKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const payload = await readJson<IdentityToolkitSignInBody & IdentityToolkitErrorBody>(
    response,
  );

  if (!response.ok) {
    throw parseIdentityToolkitError(payload, response.status);
  }

  return payload;
}

function toPasswordAuthResult(
  payload: IdentityToolkitSignInBody,
): FirebasePasswordAuthResult {
  if (
    !payload.idToken ||
    !payload.refreshToken ||
    !payload.expiresIn ||
    !payload.localId
  ) {
    throw new FirebaseAuthRestError(
      "INVALID_RESPONSE",
      "Firebase Authentication returned an incomplete session",
      502,
    );
  }

  return {
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
    expiresIn: Number.parseInt(payload.expiresIn, 10),
    localId: payload.localId,
    email: payload.email ?? "",
  };
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
}) {
  const payload = await postIdentityToolkit("accounts:signUp", {
    email: input.email,
    password: input.password,
    returnSecureToken: true,
  });

  return toPasswordAuthResult(payload);
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}) {
  const payload = await postIdentityToolkit("accounts:signInWithPassword", {
    email: input.email,
    password: input.password,
    returnSecureToken: true,
  });

  return toPasswordAuthResult(payload);
}

export async function refreshIdToken(refreshToken: string) {
  const key = getFirebaseWebApiKey();
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
  );
  const payload = await readJson<SecureTokenBody & IdentityToolkitErrorBody>(response);

  if (!response.ok) {
    throw parseIdentityToolkitError(payload, response.status);
  }

  if (!payload.id_token || !payload.refresh_token || !payload.expires_in) {
    throw new FirebaseAuthRestError(
      "INVALID_RESPONSE",
      "Firebase Authentication returned an incomplete refresh session",
      502,
    );
  }

  return {
    idToken: payload.id_token,
    refreshToken: payload.refresh_token,
    expiresIn: Number.parseInt(payload.expires_in, 10),
    localId: payload.user_id ?? "",
  };
}
