import type { ShopPrincipal, ShopUserRole } from "@ctrlp/types";

const ROLES = new Set<string>(["OWNER", "MANAGER", "STAFF"]);

export type ShopClaims = Pick<ShopPrincipal, "shopId" | "shopUserId" | "role">;

/** Builds the principal from a verified ID token's custom claims, or undefined if they're missing. */
export function principalFromClaims(uid: string, claims: Record<string, unknown>): ShopPrincipal | undefined {
  const { shopId, shopUserId, role } = claims;

  if (typeof shopId !== "string" || shopId.length === 0) {
    return undefined;
  }

  if (typeof shopUserId !== "string" || shopUserId.length === 0) {
    return undefined;
  }

  if (typeof role !== "string" || !ROLES.has(role)) {
    return undefined;
  }

  return { uid, shopId, shopUserId, role: role as ShopUserRole };
}

export function claimsFor(user: { id: string; shopId: string; role: ShopUserRole }): ShopClaims {
  return { shopId: user.shopId, shopUserId: user.id, role: user.role };
}

export function claimsMatch(claims: Record<string, unknown> | undefined, expected: ShopClaims) {
  return (
    claims !== undefined &&
    claims.shopId === expected.shopId &&
    claims.shopUserId === expected.shopUserId &&
    claims.role === expected.role
  );
}

/**
 * Reads a JWT's payload without verifying it. Only for tokens that just came from Google over TLS,
 * to decide whether their claims need repairing; never for authorization.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const payload = token.split(".")[1];

  if (!payload) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** A principal for server-side actors such as the payment provider or an agent key. */
export function systemPrincipal(shopId: string, actorId: string): ShopPrincipal {
  return { uid: `system:${actorId}`, shopId, shopUserId: actorId, role: "OWNER" };
}
