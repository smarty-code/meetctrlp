import {
  getFirebaseAuth,
  isInternalPhoneEmail,
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
import { eq } from "drizzle-orm";

import { getDb } from "@/src/db/client";
import { shopUsers, shops, type ShopUserRow } from "@/src/db/schema";
import { makeShopSlug } from "@/src/lib/slug";
import {
  AuthServiceError,
  isUniqueViolation,
  mapFirebaseAdminError,
  mapFirebaseAuthError,
} from "@/src/modules/auth/auth.errors";

function publicEmail(email: string | null | undefined) {
  if (!email || isInternalPhoneEmail(email)) {
    return null;
  }

  return email;
}

function toSessionUser(row: ShopUserRow): AuthSessionUser {
  return {
    id: row.id,
    shopId: row.shopId,
    name: row.name,
    email: publicEmail(row.email),
    phone: row.phone,
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  };
}

function toSessionResponse(
  row: ShopUserRow,
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
  const mapped =
    mapFirebaseAuthError(error) ?? mapFirebaseAdminError(error);

  if (mapped) {
    throw mapped;
  }

  if (isUniqueViolation(error, "email")) {
    throw new AuthServiceError(409, "an account with this email already exists");
  }

  if (isUniqueViolation(error, "phone")) {
    throw new AuthServiceError(409, "an account with this phone already exists");
  }

  throw error;
}

async function findShopUserByFirebaseUid(firebaseUid: string) {
  const [row] = await getDb()
    .select()
    .from(shopUsers)
    .where(eq(shopUsers.firebaseUid, firebaseUid))
    .limit(1);

  return row;
}

async function findShopUserByPhone(phone: string) {
  const [row] = await getDb()
    .select()
    .from(shopUsers)
    .where(eq(shopUsers.phone, phone))
    .limit(1);

  return row;
}

async function touchLastLogin(id: string) {
  const [row] = await getDb()
    .update(shopUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(shopUsers.id, id))
    .returning();

  return row;
}

async function insertShopAndOwner(input: {
  name: string;
  shopName: string;
  email: string | null;
  phone: string | null;
  firebaseUid: string;
}) {
  const db = getDb();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const [shop] = await tx
          .insert(shops)
          .values({
            name: input.shopName,
            slug: makeShopSlug(input.shopName),
            email: input.email,
            phone: input.phone,
          })
          .returning();

        const [user] = await tx
          .insert(shopUsers)
          .values({
            shopId: shop.id,
            name: input.name,
            email: input.email,
            phone: input.phone,
            firebaseUid: input.firebaseUid,
            role: "OWNER",
            status: "ACTIVE",
          })
          .returning();

        return user;
      });
    } catch (error) {
      if (isUniqueViolation(error, "slug") && attempt < 4) {
        continue;
      }

      throw error;
    }
  }

  throw new AuthServiceError(500, "failed to create shop");
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
  const phone = input.phone
    ? normalizePhoneNumber(input.phone)
    : null;

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

export async function registerShopOwner(
  input: RegisterRequest,
): Promise<AuthSessionResponse> {
  const identifiers = resolveRegisterIdentifiers(input);
  const session = await signUpWithPassword({
    email: identifiers.firebaseEmail,
    password: input.password,
  }).catch(rethrowMapped);

  try {
    if (identifiers.phone) {
      await getFirebaseAuth().updateUser(session.localId, {
        phoneNumber: identifiers.phone,
        displayName: input.name,
      });
    } else {
      await getFirebaseAuth().updateUser(session.localId, {
        displayName: input.name,
      });
    }

    const user = await insertShopAndOwner({
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

  const updated = (await touchLastLogin(existing.id)) ?? existing;
  return toSessionResponse(updated, session);
}

export async function refreshShopUserSession(
  input: RefreshRequest,
): Promise<AuthSessionResponse> {
  const session = await refreshIdToken(input.refreshToken).catch(rethrowMapped);
  const decoded = await getFirebaseAuth()
    .verifyIdToken(session.idToken)
    .catch(rethrowMapped);

  const existing = await findShopUserByFirebaseUid(decoded.uid);

  if (!existing || existing.status !== "ACTIVE") {
    throw new AuthServiceError(401, "unauthorized");
  }

  return toSessionResponse(existing, session);
}

export async function logoutShopUser(idToken: string) {
  const decoded = await getFirebaseAuth()
    .verifyIdToken(idToken)
    .catch(() => {
      throw new AuthServiceError(401, "unauthorized");
    });

  await getFirebaseAuth().revokeRefreshTokens(decoded.uid);
}

export async function requireShopUser(idToken: string): Promise<AuthSessionUser> {
  const decoded = await getFirebaseAuth()
    .verifyIdToken(idToken)
    .catch(() => {
      throw new AuthServiceError(401, "unauthorized");
    });

  const existing = await findShopUserByFirebaseUid(decoded.uid);

  if (!existing) {
    throw new AuthServiceError(401, "unauthorized");
  }

  if (existing.status !== "ACTIVE") {
    throw new AuthServiceError(403, "account is not active");
  }

  return toSessionUser(existing);
}
