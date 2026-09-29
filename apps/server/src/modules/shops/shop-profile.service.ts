import { FieldValue, getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import type { UpdateShopProfileRequestInput } from "@ctrlp/schemas";
import type { AuthSessionUser } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { getShop, listActiveStaff } from "@/src/modules/shops/firestore-shop-store";

export async function getShopProfile(user: AuthSessionUser) {
  const shop = await getShop(user.shopId);

  if (!shop) {
    throw new AuthServiceError(404, "shop not found");
  }

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      phone: shop.phone,
      email: shop.email,
      status: shop.status,
      address: shop.address,
      addressParts: shop.addressParts,
    },
  };
}

export async function updateShopProfile(user: AuthSessionUser, input: UpdateShopProfileRequestInput) {
  const reference = getFirebaseFirestore().doc(`shops/${user.shopId}`);
  await getFirebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) {
      throw new AuthServiceError(404, "shop not found");
    }
    transaction.update(reference, {
      name: input.name,
      phone: input.phone,
      email: input.email ? input.email : null,
      address: {
        line1: input.address.line1 ?? null,
        line2: input.address.line2 ?? null,
        city: input.address.city ?? null,
        state: input.address.state ?? null,
        postalCode: input.address.postalCode ?? null,
        country: input.address.country ?? "India",
      },
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return getShopProfile(user);
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
