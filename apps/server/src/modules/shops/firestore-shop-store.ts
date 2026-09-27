import { createHash, randomUUID } from "node:crypto";

import { FieldValue, getFirebaseFirestore, type Timestamp } from "@ctrlp/firebase/firestore";
import type { ShopUserRole, ShopUserStatus } from "@ctrlp/types";

import { makeShopSlug } from "@/src/lib/slug";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";

export type StoredShopUser = {
  id: string;
  shopId: string;
  firebaseUid: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: ShopUserRole;
  status: ShopUserStatus;
  lastLoginAt: string | null;
};

export type StoredShop = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  address: string | null;
};

const ROLES = new Set<ShopUserRole>(["OWNER", "MANAGER", "STAFF"]);
const STATUSES = new Set<ShopUserStatus>(["ACTIVE", "INACTIVE", "SUSPENDED"]);

type LookupKind = "firebaseUid" | "phone" | "email";

function lookupDocId(kind: LookupKind, value: string) {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex");
}

function timestampToIso(value: unknown) {
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

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function formatAddress(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const address = value as Record<string, unknown>;
  const parts = ["line1", "line2", "city", "state", "postalCode", "country"]
    .map((key) => address[key])
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0);

  return parts.length > 0 ? parts.join(", ") : null;
}

function parseShopUser(
  data: Record<string, unknown>,
  fallbackId: string,
  fallbackShopId: string,
): StoredShopUser | undefined {
  const role = data.role;
  const status = data.status;

  if (typeof role !== "string" || !ROLES.has(role as ShopUserRole)) {
    return undefined;
  }

  if (typeof status !== "string" || !STATUSES.has(status as ShopUserStatus)) {
    return undefined;
  }

  if (typeof data.firebaseUid !== "string" || typeof data.name !== "string") {
    return undefined;
  }

  return {
    id: typeof data.id === "string" ? data.id : fallbackId,
    shopId: typeof data.shopId === "string" ? data.shopId : fallbackShopId,
    firebaseUid: data.firebaseUid,
    name: data.name,
    email: textOrNull(data.email),
    phone: textOrNull(data.phone),
    role: role as ShopUserRole,
    status: status as ShopUserStatus,
    lastLoginAt: timestampToIso(data.lastLoginAt),
  };
}

async function findByLookup(kind: LookupKind, value: string) {
  const db = getFirebaseFirestore();
  const lookup = await db.doc(`authLookups/${lookupDocId(kind, value)}`).get();

  if (!lookup.exists) {
    return undefined;
  }

  const data = lookup.data() as Record<string, unknown>;
  const shopId = textOrNull(data.shopId);
  const userId = textOrNull(data.userId);

  if (!shopId || !userId) {
    return undefined;
  }

  const user = await db.doc(`shops/${shopId}/users/${userId}`).get();

  if (!user.exists) {
    return undefined;
  }

  return parseShopUser(user.data() as Record<string, unknown>, user.id, shopId);
}

function isAlreadyExists(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = String(error.code);
  return code === "6" || code === "already-exists" || code === "ALREADY_EXISTS";
}

export function findShopUserByFirebaseUid(firebaseUid: string) {
  return findByLookup("firebaseUid", firebaseUid);
}

export function findShopUserByPhone(phone: string) {
  return findByLookup("phone", phone);
}

export function findShopUserByEmail(email: string) {
  return findByLookup("email", email);
}

export async function createShopWithOwner(input: {
  name: string;
  shopName: string;
  email: string | null;
  phone: string | null;
  firebaseUid: string;
}) {
  const db = getFirebaseFirestore();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = makeShopSlug(input.shopName);
    const taken = await db.collection("shops").where("slug", "==", slug).limit(1).get();

    if (!taken.empty) {
      continue;
    }

    const shopId = randomUUID();
    const userId = randomUUID();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.set(db.doc(`shops/${shopId}`), {
      id: shopId,
      name: input.shopName,
      slug,
      phone: input.phone,
      email: input.email,
      status: "ACTIVE",
      service: "DOCUMENT_PRINT",
      address: null,
      capabilities: {
        bwPrinting: true,
        colorPrinting: false,
        a4Printing: true,
        a3Printing: false,
      },
      pricing: {
        currency: "INR",
        unit: "PER_PAGE",
        bwA4PricePaise: 0,
        colorA4PricePaise: 0,
        colorA3PricePaise: 0,
        updatedAt: now,
      },
      businessHours: [],
      stats: {
        totalOrdersToday: 0,
        grossRevenueTodayPaise: 0,
        cashInDrawerTodayPaise: 0,
      },
      createdAt: now,
      updatedAt: now,
    });

    batch.set(db.doc(`shops/${shopId}/users/${userId}`), {
      id: userId,
      shopId,
      firebaseUid: input.firebaseUid,
      name: input.name,
      phone: input.phone,
      email: input.email,
      role: "OWNER",
      status: "ACTIVE",
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const lookups: Array<[LookupKind, string]> = [["firebaseUid", input.firebaseUid]];

    if (input.phone) {
      lookups.push(["phone", input.phone]);
    }

    if (input.email) {
      lookups.push(["email", input.email]);
    }

    for (const [kind, value] of lookups) {
      batch.create(db.doc(`authLookups/${lookupDocId(kind, value)}`), {
        kind,
        value,
        shopId,
        userId,
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      if (isAlreadyExists(error)) {
        throw new AuthServiceError(409, "an account with these details already exists");
      }

      throw error;
    }

    return {
      id: userId,
      shopId,
      firebaseUid: input.firebaseUid,
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: "OWNER",
      status: "ACTIVE",
      lastLoginAt: null,
    } satisfies StoredShopUser;
  }

  throw new AuthServiceError(500, "failed to create shop");
}

export async function touchLastLogin(user: StoredShopUser) {
  const lastLoginAt = new Date().toISOString();

  await getFirebaseFirestore().doc(`shops/${user.shopId}/users/${user.id}`).set(
    {
      lastLoginAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    ...user,
    lastLoginAt,
  };
}

export async function getShop(shopId: string): Promise<StoredShop | undefined> {
  const snapshot = await getFirebaseFirestore().doc(`shops/${shopId}`).get();

  if (!snapshot.exists) {
    return undefined;
  }

  const data = snapshot.data() as Record<string, unknown>;

  if (typeof data.name !== "string") {
    return undefined;
  }

  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    name: data.name,
    phone: textOrNull(data.phone),
    email: textOrNull(data.email),
    status: typeof data.status === "string" ? data.status : "ACTIVE",
    address: formatAddress(data.address),
  };
}

export async function listActiveStaff(shopId: string) {
  const snapshot = await getFirebaseFirestore().collection(`shops/${shopId}/users`).get();

  return snapshot.docs
    .map((document) =>
      parseShopUser(document.data() as Record<string, unknown>, document.id, shopId),
    )
    .filter((user): user is StoredShopUser => user?.status === "ACTIVE")
    .sort((left, right) => left.name.localeCompare(right.name));
}
