import { getServiceAccessToken } from "@ctrlp/firebase";

import { currentRequestContext } from "@/src/lib/request-context";
import {
  classifyRingError,
  doorbellUrl,
  isEmulatorUrl,
  mergeRings,
  ringBody,
  type Ring,
} from "@/src/modules/realtime/ring-model";

export type { Ring, RingEvent } from "@/src/modules/realtime/ring-model";

const RING_TIMEOUT_MS = 2000;
const RETRY_DELAY_MS = 200;
const PENDING_RINGS = Symbol("pendingRings");

let warnedMissingUrl = false;

/**
 * Rings `/doorbell/{shopId}` in Realtime Database after a committed change, so the shop's agents
 * and visible desktops fetch what changed (TRAFFIC_SCALING_V2 6.9). The ring carries timestamps and
 * a short "last event" for notifications, never order data.
 *
 * Inside a request context, rings are merged per shop and sent once before the response; outside
 * one, the ring is sent straight away. Either way it is awaited and never throws.
 */
export async function ringShop(shopId: string, ring: Ring) {
  const context = currentRequestContext();

  if (!context) {
    await sendRing(shopId, ring);
    return;
  }

  let pending = context.values.get(PENDING_RINGS) as Map<string, Ring> | undefined;

  if (!pending) {
    const rings = new Map<string, Ring>();
    pending = rings;
    context.values.set(PENDING_RINGS, rings);
    context.finishers.add(async () => {
      const queued = [...rings];
      rings.clear();
      await Promise.all(queued.map(([queuedShopId, queuedRing]) => sendRing(queuedShopId, queuedRing)));
    });
  }

  const existing = pending.get(shopId);
  pending.set(shopId, existing ? mergeRings(existing, ring) : ring);
}

async function authorization(databaseUrl: string) {
  return `Bearer ${isEmulatorUrl(databaseUrl) ? "owner" : await getServiceAccessToken()}`;
}

async function sendRing(shopId: string, ring: Ring) {
  const databaseUrl = process.env.FIREBASE_DATABASE_URL;

  if (!databaseUrl) {
    if (!warnedMissingUrl) {
      warnedMissingUrl = true;
      console.warn(JSON.stringify({ severity: "WARNING", message: "ring_skipped", reason: "FIREBASE_DATABASE_URL is not set" }));
    }
    return;
  }

  const counters = currentRequestContext()?.counters;
  let outcome: "unknown" | "failed" = "failed";
  let status: number | undefined;

  if (counters) {
    counters.rings += 1;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    try {
      // Node's fetch pools connections per origin, so rings reuse one warm TLS connection.
      const response = await fetch(doorbellUrl(databaseUrl, shopId), {
        method: "PATCH",
        headers: { Authorization: await authorization(databaseUrl), "Content-Type": "application/json" },
        body: JSON.stringify(ringBody(ring)),
        signal: AbortSignal.timeout(RING_TIMEOUT_MS),
      });
      // Read the body so the connection goes back to the pool.
      await response.arrayBuffer().catch(() => undefined);

      if (response.ok) {
        return;
      }

      outcome = "failed";
      status = response.status;
    } catch (error) {
      outcome = classifyRingError(error);
      status = undefined;
    }
  }

  if (counters) {
    counters.ringFailures += 1;
  }

  console.error(
    JSON.stringify({
      severity: outcome === "unknown" ? "WARNING" : "ERROR",
      message: outcome === "unknown" ? "ring_unknown" : "ring_failed",
      shopId,
      event: ring.event,
      orderId: ring.orderId,
      ...(status === undefined ? {} : { status }),
    }),
  );
}
