import type { AuthSessionUser } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { getShop, listActiveStaff } from "@/src/modules/shops/firestore-shop-store";

export async function getShopProfile(user: AuthSessionUser) {
  const shop = await getShop(user.shopId);

  if (!shop) {
    throw new AuthServiceError(404, "shop not found");
  }

  return { shop };
}

export async function listActiveShopStaff(user: AuthSessionUser) {
  const staff = await listActiveStaff(user.shopId);

  return {
    staff: staff.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      status: member.status,
      lastLoginAt: member.lastLoginAt,
    })),
  };
}
