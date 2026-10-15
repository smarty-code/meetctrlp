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
  ShopPrincipal,
} from "@ctrlp/types";

import {
  AuthServiceError,
  mapFirebaseAdminError,
  mapFirebaseAuthError,
} from "@/src/modules/auth/auth.errors";
import {
  claimsFor,
  claimsMatch,
  decodeJwtPayload,
  principalFromClaims,
} from "@/src/modules/auth/principal";
import {
  createShopWithOwner,
  deleteShopWithOwner,
  findShopUserByEmail,
  findShopUserByFirebaseUid,
  findShopUserByPhone,
  getShopUser,
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

type SessionTokens = { idToken: string; refreshToken: string; expiresIn: number };

/**
 * Makes sure the session's ID token carries this user's claims. Tokens minted before the claims
 * were set (or changed) don't, so set them and refresh the token.
 */
async function withClaims(user: StoredShopUser, session: SessionTokens): Promise<SessionTokens> {
  const expected = claimsFor(user);

  if (claimsMatch(decodeJwtPayload(session.idToken), expected)) {
    return session;
  }

  await getFirebaseAuth().setCustomUserClaims(user.firebaseUid, expected);
  return refreshIdToken(session.refreshToken);
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

  let user: StoredShopUser | undefined;

  try {
    user = await createShopWithOwner({
      name: input.name,
      shopName: input.shopName,
      email: identifiers.email,
      phone: identifiers.phone,
      firebaseUid: session.localId,
    });

    // Claims are required: every API call authorizes from them. The sign-up token predates them,
    // so withClaims also refreshes it.
    return toSessionResponse(user, await withClaims(user, session));
  } catch (error) {
    if (user) {
      await deleteShopWithOwner(user);
    }

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

  const tokens = await withClaims(existing, session).catch(rethrowMapped);
  return toSessionResponse(await touchLastLogin(existing), tokens);
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

/**
 * Signing out doesn't revoke refresh tokens by default: one login often runs on several shop PCs,
 * and revoking would sign every one of them out. `allDevices` revokes them all.
 */
export async function logoutShopUser(idToken: string, options: { allDevices?: boolean } = {}) {
  const principal = await requireShopPrincipal(idToken, { checkRevoked: true });

  if (!options.allDevices) {
    return;
  }

  try {
    await getFirebaseAuth().revokeRefreshTokens(principal.uid);
  } catch (error) {
    console.error("Failed to revoke Firebase refresh tokens", error);
  }
}

/**
 * Verifies the ID token locally (cached Google keys, no network call) and reads the caller from its
 * custom claims, with no Firestore reads. `checkRevoked` adds a call to Google; use it only on
 * sign-out and staff management.
 */
export async function requireShopPrincipal(
  idToken: string,
  options: { checkRevoked?: boolean } = {},
): Promise<ShopPrincipal> {
  const decoded = await getFirebaseAuth()
    .verifyIdToken(idToken, options.checkRevoked ?? false)
    .catch((error: unknown) => {
      throw mapFirebaseAdminError(error) ?? error;
    });
  const principal = principalFromClaims(decoded.uid, decoded);

  if (!principal) {
    throw new AuthServiceError(401, "CLAIMS_MISSING");
  }

  return principal;
}

/** The full user record for `/api/auth/me` (1 read). */
export async function getCurrentShopUser(principal: ShopPrincipal): Promise<AuthSessionUser> {
  const user = await getShopUser(principal.shopId, principal.shopUserId);

  if (!user || user.firebaseUid !== principal.uid) {
    throw new AuthServiceError(401, "unauthorized");
  }

  if (user.status !== "ACTIVE") {
    throw new AuthServiceError(403, "account is not active");
  }

  return toSessionUser(user);
}
