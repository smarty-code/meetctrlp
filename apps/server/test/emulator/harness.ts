// Shared setup for the emulator integration tests (`pnpm --filter server test:emulator`): emulator
// resets, a fake S3 that records deletes, and seed helpers that write the shapes the services read.
// `preload.mjs` has already checked that this process talks only to the emulators.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import type { ShopPrincipal } from "@ctrlp/types";

const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;

export function db() {
  return getFirebaseFirestore();
}

export function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * MINUTE_MS);
}

export function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

function project() {
  return process.env.GCLOUD_PROJECT ?? "";
}

/** Deletes every document in the Firestore emulator. */
export async function clearFirestore() {
  const response = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${project()}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(`Could not clear the Firestore emulator: ${response.status}`);
  }
}

/** Deletes every user in the Auth emulator. */
export async function clearAuth() {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${project()}/accounts`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Could not clear the Auth emulator: ${response.status}`);
  }
}

export type FakeS3 = {
  /** Object keys deleted so far, in order. */
  deleted: string[];
  /** Keys whose delete is refused with 403, as a storage outage would be. */
  failing: Set<string>;
  /** Keys a HEAD reports as not found (404); every other key exists. */
  missing: Set<string>;
  close: () => Promise<void>;
};

/**
 * A local stand-in for the S3 bucket that answers deletes (and records them) and HEAD requests.
 * Presigned download links are signed offline, so they need only the endpoint and keys set here.
 */
export async function startFakeS3(): Promise<FakeS3> {
  const deleted: string[] = [];
  const failing = new Set<string>();
  const missing = new Set<string>();
  const server = createServer((request, response) => {
    request.resume();
    // Path-style requests: /{bucket}/{key}.
    const segments = new URL(request.url ?? "/", "http://fake-s3").pathname.split("/").slice(2);
    const key = segments.map(decodeURIComponent).join("/");

    if (request.method === "HEAD") {
      const gone = missing.has(key) || deleted.includes(key);
      response.writeHead(gone ? 404 : 200, gone ? {} : { "Content-Length": "2048", "Content-Type": "application/pdf" });
      response.end();
      return;
    }
    if (request.method !== "DELETE") {
      response.writeHead(501).end();
      return;
    }
    if (failing.has(key)) {
      response.writeHead(403, { "Content-Type": "application/xml" });
      response.end("<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>");
      return;
    }
    deleted.push(key);
    response.writeHead(204).end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.S3_ENDPOINT = `http://127.0.0.1:${port}`;
  process.env.S3_REGION = "auto";
  process.env.S3_BUCKET_NAME = "emulator-tests";
  process.env.S3_ACCESS_KEY_ID = "emulator-tests";
  process.env.S3_SECRET_ACCESS_KEY = "emulator-tests";

  return {
    deleted,
    failing,
    missing,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export function newShopId() {
  return `shop-${randomUUID().slice(0, 8)}`;
}

export function principalFor(shopId: string): ShopPrincipal {
  return { uid: "owner-uid", shopId, shopUserId: "owner-user", role: "OWNER" };
}

export async function seedShop(
  shopId: string,
  orderAutomation: { autoAcceptPaidOnline?: boolean; autoDispatchAcceptedOrders?: boolean } = {},
) {
  await db().doc(`shops/${shopId}`).set({
    id: shopId,
    name: "Emulator Test Shop",
    orderAutomation: {
      autoAcceptPaidOnline: orderAutomation.autoAcceptPaidOnline ?? true,
      autoDispatchAcceptedOrders: orderAutomation.autoDispatchAcceptedOrders ?? true,
      cashRequiresOperatorAcceptance: true,
    },
    capabilities: { colorPrinting: true, a3Printing: false },
  });
}

export async function seedAgent(shopId: string, agentId: string) {
  await db().doc(`shops/${shopId}/agents/${agentId}`).set({ id: agentId, shopId, status: "ONLINE" });
}

export async function seedPrinter(shopId: string, printerId: string, agentId: string, fields: Record<string, unknown> = {}) {
  await db().doc(`shops/${shopId}/printers/${printerId}`).set({
    id: printerId,
    shopId,
    agentId,
    name: `Printer ${printerId}`,
    systemName: `\\\\PC\\${printerId}`,
    enabled: true,
    status: "ONLINE",
    isColorCapable: true,
    capabilities: ["A4", "COLOR"],
    offered: { bw: true, color: true, a4: true, a3: false },
    maximumCopies: 99,
    activeSpoolJobs: 0,
    ...fields,
  });
}

/** An order document as checkout stores it: a stored PDF in the bucket by default. */
export function storedDocument(shopId: string, orderId: string, docId: string, fields: Record<string, unknown> = {}) {
  return {
    id: docId,
    docId,
    storageKey: `uploads/${shopId}/${orderId}/${docId}.pdf`,
    storageBackend: "s3",
    originalFilename: `${docId}.pdf`,
    mimeType: "application/pdf",
    fileSizeBytes: 2048,
    pageCount: 2,
    copies: 1,
    colorMode: "BW",
    paperSize: "A4",
    unitPricePaise: 200,
    totalPaise: 400,
    sha256Hash: `sha-${docId}`,
    shreddedAt: null,
    ...fields,
  };
}

export async function seedOrder(shopId: string, orderId: string, fields: Record<string, unknown> = {}) {
  await db().doc(`shops/${shopId}/orders/${orderId}`).set({
    id: orderId,
    shopId,
    orderNumber: `ORD-${orderId}`,
    pickupCode: "4321",
    channel: "SHOP",
    status: "SUBMITTED",
    payment: { method: "CASH", status: "PENDING" },
    amounts: { subtotalMinorUnits: 400, taxMinorUnits: 0, totalMinorUnits: 400 },
    documents: [storedDocument(shopId, orderId, "doc-1")],
    lifecycle: {},
    createdAt: minutesAgo(30),
    updatedAt: minutesAgo(30),
    ...fields,
  });
}

export async function seedJob(shopId: string, orderId: string, jobId: string, fields: Record<string, unknown> = {}) {
  await db().doc(`shops/${shopId}/orders/${orderId}/printJobs/${jobId}`).set({
    id: jobId,
    orderId,
    shopId,
    documentId: "doc-1",
    printerId: "printer-1",
    printerName: "Printer printer-1",
    printerSystemName: "\\\\PC\\printer-1",
    agentId: "agent-1",
    requestedOverrides: {},
    resolvedSettings: { colorMode: "BW", copies: 1, paperSize: "A4", pageSelection: "all", inputTray: "AUTO_SELECT" },
    status: "QUEUED",
    pagesTotal: 2,
    pagesPrinted: 0,
    spoolerJobId: null,
    retryCount: 0,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    leaseId: null,
    claimedAt: null,
    createdAt: minutesAgo(20),
    updatedAt: minutesAgo(20),
    ...fields,
  });
}

export async function readOrder(shopId: string, orderId: string) {
  return (await db().doc(`shops/${shopId}/orders/${orderId}`).get()).data() ?? {};
}

export async function readJob(shopId: string, orderId: string, jobId: string) {
  return (await db().doc(`shops/${shopId}/orders/${orderId}/printJobs/${jobId}`).get()).data() ?? {};
}

/** Milliseconds of a Firestore timestamp field, or NaN when it isn't one. */
export function millisOf(value: unknown) {
  return value && typeof value === "object" && "toMillis" in value ? (value as { toMillis: () => number }).toMillis() : Number.NaN;
}
