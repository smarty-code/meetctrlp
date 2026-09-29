import { FieldValue, getFirebaseFirestore, type Timestamp } from "@ctrlp/firebase/firestore";

import { getShopConfigByShopId } from "@/src/modules/shops/shop-config.service";
import { getShop, getShopBySlug, type StoredShop } from "@/src/modules/shops/firestore-shop-store";
import {
  isShopAcceptingOrders,
  mapShopStatusToCustomer,
} from "@/src/modules/print-user/print-user.helpers";
import type { PublicShopDto } from "@/src/modules/print-user/print-user.types";

export function toPublicShopDto(shop: StoredShop, config: Awaited<ReturnType<typeof getShopConfigByShopId>>): PublicShopDto {
  const startingPriceA4 = Math.max(1, Math.round(config.pricing.bwA4PricePaise / 100));

  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug ?? "",
    status: mapShopStatusToCustomer(shop.status, config.openNow),
    shopStatus: shop.status,
    phone: shop.phone,
    email: shop.email,
    address: shop.address,
    addressParts: shop.addressParts,
    openNow: config.openNow,
    estimatedMinutes: 10,
    startingPriceA4,
    capabilities: config.capabilities,
    pricing: {
      currency: config.pricing.currency,
      unit: config.pricing.unit,
      bwA4PricePaise: config.pricing.bwA4PricePaise,
      colorA4PricePaise: config.pricing.colorA4PricePaise,
      colorA3PricePaise: config.pricing.colorA3PricePaise,
    },
    businessHours: config.businessHours,
    acceptsCash: true,
    acceptsOnline: true,
  };
}

export async function getPublicShopBySlug(slug: string) {
  const shop = await getShopBySlug(slug);
  if (!shop || !shop.slug) {
    return undefined;
  }
  const config = await getShopConfigByShopId(shop.id);
  return toPublicShopDto(shop, config);
}

export async function getPublicShopById(shopId: string) {
  const shop = await getShop(shopId);
  if (!shop) {
    return undefined;
  }
  const config = await getShopConfigByShopId(shop.id);
  return toPublicShopDto(shop, config);
}

export function requireActivePublicShop(shop: PublicShopDto) {
  return isShopAcceptingOrders(shop.shopStatus);
}

export function timestampToIso(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as Timestamp).toDate().toISOString();
  }

  return typeof value === "string" ? value : null;
}

export function firestoreNow() {
  return FieldValue.serverTimestamp();
}

export function printUsersCollection() {
  return getFirebaseFirestore().collection("printUsers");
}
