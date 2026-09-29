import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { FieldValue, getFirebaseFirestore, type Timestamp } from "@ctrlp/firebase/firestore";
import type {
  DeviceHeartbeatRequestInput,
  DeviceOfflineRequestInput,
  RegisterDeviceRequestInput,
} from "@ctrlp/schemas";
import type { AuthSessionUser } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";

const HEARTBEAT_INTERVAL_SECONDS = 30;
const STALE_AFTER_MS = 90_000;

function agentIdFor(shopId: string, deviceIdentifier: string) {
  return createHash("sha256")
    .update(`${shopId}:${deviceIdentifier}`)
    .digest("hex")
    .slice(0, 32);
}

function agentRef(shopId: string, agentId: string) {
  return getFirebaseFirestore().doc(`shops/${shopId}/agents/${agentId}`);
}

function hashAgentCredential(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function requireAgentCredential(request: Request, shopId: string, agentId: string) {
  const credential = request.headers.get("x-ctrlp-agent-key");
  if (!credential) {
    throw new AuthServiceError(401, "AGENT_CREDENTIAL_REQUIRED");
  }
  const snapshot = await agentRef(shopId, agentId).get();
  const expected = snapshot.get("apiKeyHash");
  const actual = hashAgentCredential(credential);
  if (typeof expected !== "string" || expected.length !== actual.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))) {
    throw new AuthServiceError(403, "AGENT_CREDENTIAL_INVALID");
  }
  return snapshot;
}

function timestampMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as Timestamp).toMillis();
  }

  return 0;
}

async function markStaleAgentsOffline(shopId: string, currentAgentId: string) {
  const snapshot = await getFirebaseFirestore()
    .collection(`shops/${shopId}/agents`)
    .where("status", "==", "ONLINE")
    .get();

  const cutoff = Date.now() - STALE_AFTER_MS;
  const writes = snapshot.docs
    .filter((doc) => doc.id !== currentAgentId)
    .filter((doc) => {
      const seen = timestampMillis(doc.get("lastSeenAt"));
      return seen > 0 && seen < cutoff;
    })
    .map((doc) =>
      doc.ref.set(
        {
          status: "OFFLINE",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
    );

  await Promise.all(writes);
}

export async function registerShopDevice(
  user: AuthSessionUser,
  input: RegisterDeviceRequestInput,
) {
  const agentId = agentIdFor(user.shopId, input.deviceIdentifier);
  const reference = agentRef(user.shopId, agentId);
  const existing = await reference.get();
  const existingHash = existing.get("apiKeyHash");
  const issuedCredential =
    typeof existingHash === "string" && existingHash.length > 0
      ? null
      : randomBytes(32).toString("base64url");
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
      heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
      registeredByUserId: user.id,
      ...(issuedCredential ? { apiKeyHash: hashAgentCredential(issuedCredential) } : {}),
      lastSeenAt: now,
      updatedAt: now,
      ...(existing.exists
        ? {}
        : {
            registeredAt: now,
            createdAt: now,
          }),
    },
    { merge: true },
  );

  return {
    deviceId: agentId,
    ...(issuedCredential ? { agentCredential: issuedCredential } : {}),
    heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    status: "ONLINE" as const,
  };
}

export async function recordDeviceHeartbeat(
  user: AuthSessionUser,
  input: DeviceHeartbeatRequestInput,
) {
  const reference = agentRef(user.shopId, input.deviceId);
  const existing = await reference.get();

  if (!existing.exists || existing.get("shopId") !== user.shopId) {
    throw new AuthServiceError(404, "device is not registered");
  }

  await reference.set(
    {
      status: "ONLINE",
      lastSeenAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(input.memoryWorkingSetBytes === undefined
        ? {}
        : { memoryWorkingSetBytes: input.memoryWorkingSetBytes }),
      ...(input.spoolerJobCount === undefined
        ? {}
        : { spoolerJobCount: input.spoolerJobCount }),
      ...(input.onlinePrinterCount === undefined
        ? {}
        : { onlinePrinterCount: input.onlinePrinterCount }),
    },
    { merge: true },
  );

  try {
    await markStaleAgentsOffline(user.shopId, input.deviceId);
  } catch (error) {
    console.error("Failed to mark stale print agents offline", error);
  }

  return {
    deviceId: input.deviceId,
    status: "ONLINE" as const,
    heartbeatIntervalSeconds:
      Number(existing.get("heartbeatIntervalSeconds")) || HEARTBEAT_INTERVAL_SECONDS,
  };
}

export async function markDeviceOffline(
  user: AuthSessionUser,
  input: DeviceOfflineRequestInput,
) {
  const reference = agentRef(user.shopId, input.deviceId);
  const existing = await reference.get();

  if (!existing.exists || existing.get("shopId") !== user.shopId) {
    throw new AuthServiceError(404, "device is not registered");
  }

  await reference.set(
    {
      status: "OFFLINE",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    deviceId: input.deviceId,
    status: "OFFLINE" as const,
  };
}
