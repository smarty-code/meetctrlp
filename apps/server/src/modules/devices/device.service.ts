import { createHash } from "node:crypto";

import { FieldValue, getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import type { DeviceOfflineRequestInput, RegisterDeviceRequestInput } from "@ctrlp/schemas";
import type { ShopPrincipal } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";

/** `lastActiveAt` is written at most this often per agent and server instance (6.7). */
const ACTIVITY_INTERVAL_MS = 10 * 60 * 1000;
const lastActivityWrite = new Map<string, number>();

function agentIdFor(shopId: string, deviceIdentifier: string) {
  return createHash("sha256")
    .update(`${shopId}:${deviceIdentifier}`)
    .digest("hex")
    .slice(0, 32);
}

function agentRef(shopId: string, agentId: string) {
  return getFirebaseFirestore().doc(`shops/${shopId}/agents/${agentId}`);
}

/**
 * Records that this PC was active, on requests it already makes (register, accept, sync, report).
 * No read, at most once every 10 minutes per instance, and never fails the request.
 */
export async function touchAgentActivity(shopId: string, agentId: string) {
  const key = `${shopId}/${agentId}`;
  const now = Date.now();
  if (now - (lastActivityWrite.get(key) ?? 0) < ACTIVITY_INTERVAL_MS) {
    return;
  }
  lastActivityWrite.set(key, now);

  try {
    await agentRef(shopId, agentId).update({ lastActiveAt: FieldValue.serverTimestamp() });
  } catch (error) {
    console.error("Failed to record agent activity", shopId, agentId, error);
  }
}

/** Registers this PC for the signed-in shop. The same PC and shop always get the same `deviceId`. */
export async function registerShopDevice(user: ShopPrincipal, input: RegisterDeviceRequestInput) {
  const agentId = agentIdFor(user.shopId, input.deviceIdentifier);
  const reference = agentRef(user.shopId, agentId);
  const existing = await reference.get();
  const now = FieldValue.serverTimestamp();

  await reference.set(
    {
      id: agentId,
      shopId: user.shopId,
      name: input.hostname,
      deviceIdentifier: input.deviceIdentifier,
      hostname: input.hostname,
      osVersion: input.osVersion,
      appVersion: input.appVersion,
      agentVersion: input.agentVersion,
      status: "ONLINE",
      registeredByUserId: user.shopUserId,
      lastActiveAt: now,
      updatedAt: now,
      // The agent's device key is gone: it calls the API with the shop user's ID token.
      apiKeyHash: FieldValue.delete(),
      heartbeatIntervalSeconds: FieldValue.delete(),
      lastSeenAt: FieldValue.delete(),
      ...(existing.exists ? {} : { registeredAt: now, createdAt: now }),
    },
    { merge: true },
  );
  lastActivityWrite.set(`${user.shopId}/${agentId}`, Date.now());

  return { deviceId: agentId, status: "ONLINE" as const };
}

/**
 * Marks this PC and its printers OFFLINE, so routing stops sending jobs to it. Called on sign-out
 * and by the agent as it exits with the app.
 */
export async function markDeviceOffline(user: ShopPrincipal, input: DeviceOfflineRequestInput) {
  const db = getFirebaseFirestore();
  const reference = agentRef(user.shopId, input.deviceId);
  const [existing, printers] = await Promise.all([
    reference.get(),
    db.collection(`shops/${user.shopId}/printers`).where("agentId", "==", input.deviceId).get(),
  ]);

  if (!existing.exists || existing.get("shopId") !== user.shopId) {
    throw new AuthServiceError(404, "device is not registered");
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(reference, { status: "OFFLINE", updatedAt: now }, { merge: true });
  for (const printer of printers.docs) {
    batch.update(printer.ref, { status: "OFFLINE", statusReason: "PC offline", updatedAt: now });
  }
  await batch.commit();

  return { deviceId: input.deviceId, status: "OFFLINE" as const, printersOffline: printers.size };
}
