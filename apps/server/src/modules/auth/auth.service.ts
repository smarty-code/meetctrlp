import {
  getFirebaseAuth,
  isInternalPhoneEmail,
  lookupIdToken,
  looksLikeEmail,
  normalizePhoneNumber,
  phoneToFirebaseEmail,
  refreshIdToken,
  signInWithPassword,
  signUpWithPassword,
} from "@ctrlp/firebase";
import type {
  AuthSessionResponse,
  AuthSessionUser,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
} from "@ctrlp/types";

import {
  AuthServiceError,
  mapFirebaseAdminError,
  mapFirebaseAuthError,
} from "@/src/modules/auth/auth.errors";
import {
  createShopWithOwner,
  findShopUserByEmail,
  findShopUserByFirebaseUid,
  findShopUserByPhone,
  touchLastLogin,
  type StoredShopUser,
} from "@/src/modules/shops/firestore-shop-store";

function publicEmail(email: string | null | undefined) {
  if (!email || isInternalPhoneEmail(email)) {
    return null;
  }

  return email;
}

function toSessionUser(row: StoredShopUser): AuthSessionUser {
  return {
    id: row.id,
    shopId: row.shopId,
    name: row.name,
    email: publicEmail(row.email),
    phone: row.phone,
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt,
  };
}

function toSessionResponse(
  row: StoredShopUser,
  tokens: { idToken: string; refreshToken: string; expiresIn: number },
): AuthSessionResponse {
  return {
    user: toSessionUser(row),
    tokens: {
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    },
  };
}

function rethrowMapped(error: unknown): never {
  const mapped = mapFirebaseAuthError(error) ?? mapFirebaseAdminError(error);

  if (mapped) {
    throw mapped;
  }

  throw error;
}

async function deleteFirebaseUser(uid: string) {
  try {
    await getFirebaseAuth().deleteUser(uid);
  } catch (error) {
    console.error("Failed to roll back Firebase user", uid, error);
  }
}

function resolveRegisterIdentifiers(input: RegisterRequest) {
  const email = input.email?.trim().toLowerCase() || undefined;
  const phone = input.phone ? normalizePhoneNumber(input.phone) : null;

  if (input.phone && !phone) {
    throw new AuthServiceError(400, "invalid phone number");
  }

  if (email && isInternalPhoneEmail(email)) {
    throw new AuthServiceError(400, "this email domain is reserved");
  }

  if (!email && !phone) {
    throw new AuthServiceError(400, "email or phone is required");
  }

  return {
    email: email ?? null,
    phone,
    firebaseEmail: email ?? phoneToFirebaseEmail(phone as string),
  };
}

async function resolveLoginEmail(identifier: string) {
  if (looksLikeEmail(identifier)) {
    const email = identifier.trim().toLowerCase();

    if (isInternalPhoneEmail(email)) {
      throw new AuthServiceError(400, "this email domain is reserved");
    }

    return email;
  }

  const phone = normalizePhoneNumber(identifier);

  if (!phone) {
    throw new AuthServiceError(400, "invalid phone number");
  }

  const existing = await findShopUserByPhone(phone);
  return existing?.email ?? phoneToFirebaseEmail(phone);
}

async function signUpOrResume(input: {
  email: string;
  password: string;
  duplicateMessage: string;
}) {
  try {
    return await signUpWithPassword({
      email: input.email,
      password: input.password,
    });
  } catch (error) {
    const mapped = mapFirebaseAuthError(error) ?? mapFirebaseAdminError(error);

    if (!mapped || mapped.status !== 409) {
      rethrowMapped(error);
    }

    const session = await signInWithPassword({
      email: input.email,
      password: input.password,
    }).catch(rethrowMapped);
    const existing = await findShopUserByFirebaseUid(session.localId);

    if (existing) {
      throw new AuthServiceError(409, input.duplicateMessage);
    }

    return session;
  }
}

async function requireActiveUser(firebaseUid: string) {
  const existing = await findShopUserByFirebaseUid(firebaseUid);

  if (!existing) {
    throw new AuthServiceError(401, "unauthorized");
  }

  if (existing.status !== "ACTIVE") {
    throw new AuthServiceError(403, "account is not active");
  }

  return existing;
}

export async function registerShopOwner(
  input: RegisterRequest,
): Promise<AuthSessionResponse> {
  const identifiers = resolveRegisterIdentifiers(input);

  if (identifiers.email && (await findShopUserByEmail(identifiers.email))) {
    throw new AuthServiceError(409, "an account with this email already exists");
  }

  if (identifiers.phone && (await findShopUserByPhone(identifiers.phone))) {
    throw new AuthServiceError(409, "an account with this phone already exists");
  }

  const session = await signUpOrResume({
    email: identifiers.firebaseEmail,
    password: input.password,
    duplicateMessage: identifiers.email
      ? "an account with this email already exists"
      : "an account with this phone already exists",
  });

  try {
    const user = await createShopWithOwner({
      name: input.name,
      shopName: input.shopName,
      email: identifiers.email,
      phone: identifiers.phone,
      firebaseUid: session.localId,
    });

    try {
      await getFirebaseAuth().setCustomUserClaims(session.localId, {
        shopId: user.shopId,
        shopUserId: user.id,
        role: user.role,
      });
    } catch (error) {
      console.error("Failed to set Firebase custom claims", error);
    }

    return toSessionResponse(user, session);
  } catch (error) {
    await deleteFirebaseUser(session.localId);
    rethrowMapped(error);
  }
}

export async function loginShopUser(
  input: LoginRequest,
): Promise<AuthSessionResponse> {
  const firebaseEmail = await resolveLoginEmail(input.identifier);
  const session = await signInWithPassword({
    email: firebaseEmail,
    password: input.password,
  }).catch(rethrowMapped);

  const existing = await findShopUserByFirebaseUid(session.localId);

  if (!existing) {
    throw new AuthServiceError(401, "invalid credentials");
  }

  if (existing.status !== "ACTIVE") {
    throw new AuthServiceError(403, "account is not active");
  }

  return toSessionResponse(await touchLastLogin(existing), session);
}

export async function refreshShopUserSession(
  input: RefreshRequest,
): Promise<AuthSessionResponse> {
  const session = await refreshIdToken(input.refreshToken).catch(rethrowMapped);
  const localId =
    session.localId || (await lookupIdToken(session.idToken).catch(rethrowMapped)).localId;
  const existing = await requireActiveUser(localId);
  return toSessionResponse(existing, session);
}

export async function logoutShopUser(idToken: string) {
  const { localId } = await lookupIdToken(idToken).catch(() => {
    throw new AuthServiceError(401, "unauthorized");
  });

  try {
    await getFirebaseAuth().revokeRefreshTokens(localId);
  } catch (error) {
    console.error("Failed to revoke Firebase refresh tokens", error);
  }
}

export async function requireShopUser(idToken: string): Promise<AuthSessionUser> {
  const { localId } = await lookupIdToken(idToken).catch(() => {
    throw new AuthServiceError(401, "unauthorized");
  });

  return toSessionUser(await requireActiveUser(localId));
}
