import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { createPresignedDownloadUrl, deleteObject, isMissingObjectError, uploadObject } from "@ctrlp/firebase";
import { getFirebaseWebApiKey } from "@ctrlp/firebase/config";
import { FieldValue, getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import type { ShopPrincipal } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { inspectDocument } from "@/src/modules/documents/inspect-document";
import { createShopOrder, getShopOrder, type OrderDto } from "@/src/modules/orders/order.service";

const DOWNLOAD_TTL_SECONDS = 900;
/**
 * Agent downloads from `sync` last an hour: the agent can't ask for a fresh link, and ten files
 * downloaded one after another on a slow shop line can take longer than 15 minutes.
 */
export const AGENT_DOWNLOAD_TTL_SECONDS = 3600;

export type StoredOrderDocument = {
  id: string;
  docId: string;
  storageKey: string;
  storageBackend: "s3" | "local";
  originalFilename: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  fileSizeBytes: number;
  pageCount: number;
  copies: number;
  colorMode: "BW" | "COLOR";
  paperSize: "A4" | "A3";
  unitPricePaise: number;
  totalPaise: number;
  sha256Hash: string;
  shreddedAt: string | null;
};

type AccessType = "DOWNLOADED" | "PREVIEWED" | "SPOOLED_TO_PRINTER" | "SHREDDED";

function localPath(storageKey: string) {
  return path.join(process.cwd(), "data", "print-jobs", storageKey);
}

async function storeDocument(storageKey: string, bytes: Buffer, mimeType: string) {
  try {
    await uploadObject(storageKey, bytes, mimeType);
    return "s3" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Missing required environment variable")) {
      throw error;
    }
  }

  const destination = localPath(storageKey);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  return "local" as const;
}

function signDownload(shopId: string, orderId: string, docId: string, expiresAt: number) {
  return createHmac("sha256", getFirebaseWebApiKey())
    .update(`${shopId}:${orderId}:${docId}:${expiresAt}`)
    .digest("hex");
}

export function verifyDownloadSignature(
  shopId: string,
  orderId: string,
  docId: string,
  expiresAt: number,
  signature: string,
) {
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const expected = signDownload(shopId, orderId, docId, expiresAt);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

function findDocument(order: OrderDto, docId: string) {
  const document = order.documents.find((entry) => {
    const record = entry as { id?: string; docId?: string };
    return record.docId === docId || record.id === docId;
  }) as (OrderDto["documents"][number] & Partial<StoredOrderDocument>) | undefined;

  if (!document) {
    throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
  }

  return document;
}

export async function createPdfOrder(
  user: ShopPrincipal,
  files: Array<{
    filename: string;
    bytes: Buffer;
    mimeType: "application/pdf" | "image/jpeg" | "image/png";
    colorMode: "BW" | "COLOR";
    paperSize: "A4" | "A3";
    copies: number;
  }>,
  paymentMethod: "CASH" | "ONLINE" = "CASH",
) {
  if (files.length < 1) {
    throw new AuthServiceError(400, "at least one PDF is required");
  }

  const inspected = files.map((file) => ({
    ...file,
    ...inspectDocument(file.bytes, file.mimeType),
  }));
  const order = await createShopOrder(user, {
    paymentMethod,
    customerPhone: "+919800011122",
    documents: inspected.map((file) => ({
      originalFilename: file.filename,
      pageCount: file.pageCount,
      copies: file.copies,
      colorMode: file.colorMode,
      paperSize: file.paperSize,
    })),
  });
  const documents = order.documents.map((document, index) => {
    const file = inspected[index];
    const docId = document.id;
    return {
      ...document,
      docId,
      storageKey: `uploads/${user.shopId}/${order.id}/${docId}${file.mimeType === "application/pdf" ? ".pdf" : file.mimeType === "image/png" ? ".png" : ".jpg"}`,
      storageBackend: "local" as const,
      originalFilename: file.filename,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      pageCount: file.pageCount,
      sha256Hash: file.sha256Hash,
      shreddedAt: null,
      bytes: file.bytes,
    };
  });

  const stored = [];
  for (const document of documents) {
    const storageBackend = await storeDocument(document.storageKey, document.bytes, document.mimeType);
    const { bytes: _bytes, ...metadata } = document;
    stored.push({ ...metadata, storageBackend });
  }

  await getFirebaseFirestore().doc(`shops/${user.shopId}/orders/${order.id}`).set(
    {
      documents: stored,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return getShopOrder(user, order.id);
}

/**
 * A short-lived link to a stored document: presigned for S3, or an HMAC-signed link to this
 * server's content route for local storage. Null when the file is gone.
 */
export async function documentDownload(
  shopId: string,
  orderId: string,
  document: Partial<StoredOrderDocument> & { id?: string; docId?: string },
  origin: string,
  ttlSeconds = DOWNLOAD_TTL_SECONDS,
) {
  const docId = document.docId ?? document.id ?? "";
  if (document.shreddedAt || !document.storageKey || !document.sha256Hash) {
    return null;
  }

  const details = {
    storageKey: document.storageKey,
    sha256Hash: document.sha256Hash,
    mimeType: document.mimeType ?? "application/pdf",
    pageCount: document.pageCount ?? 1,
    expiresIn: ttlSeconds,
  };

  if (document.storageBackend === "s3") {
    return { url: await createPresignedDownloadUrl(document.storageKey, ttlSeconds), ...details };
  }

  const expiresAt = Date.now() + ttlSeconds * 1000;
  const url = new URL(`/api/v1/shops/${shopId}/orders/${orderId}/documents/${docId}/content`, origin);
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", signDownload(shopId, orderId, docId, expiresAt));
  return { url: url.toString(), ...details };
}

export async function createDocumentDownloadUrl(
  user: ShopPrincipal,
  orderId: string,
  docId: string,
  origin: string,
) {
  const order = await getShopOrder(user, orderId);
  const document = findDocument(order, docId);
  if (document.shreddedAt) {
    throw new AuthServiceError(409, "DOCUMENT_SHREDDED");
  }
  const download = await documentDownload(user.shopId, orderId, document, origin);
  if (!download) {
    throw new AuthServiceError(404, "this document has no stored file");
  }
  return download;
}

export async function readDocumentContent(shopId: string, orderId: string, docId: string) {
  const snapshot = await getFirebaseFirestore().doc(`shops/${shopId}/orders/${orderId}`).get();
  if (!snapshot.exists) {
    throw new AuthServiceError(404, "ORDER_NOT_FOUND");
  }

  const documents = (snapshot.get("documents") ?? []) as StoredOrderDocument[];
  const document = documents.find((entry) => entry.docId === docId || entry.id === docId);
  if (!document?.storageKey) {
    throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
  }
  if (document.shreddedAt) {
    throw new AuthServiceError(409, "DOCUMENT_SHREDDED");
  }

  if (document.storageBackend === "s3") {
    throw new AuthServiceError(400, "download this document from its presigned url");
  }

  const bytes = await readFile(localPath(document.storageKey));
  return { bytes, filename: document.originalFilename, sha256Hash: document.sha256Hash };
}

export async function recordDocumentAccess(
  user: ShopPrincipal,
  orderId: string,
  docId: string,
  _accessType: AccessType,
  _request: Request,
) {
  findDocument(await getShopOrder(user, orderId), docId);
  return { logId: randomUUID() };
}

/**
 * Deletes a printed document's file, then marks it `shreddedAt`. Returns false if the delete
 * failed, so the caller can retry. A file that is already gone counts as deleted.
 */
export async function shredOrderDocument(shopId: string, orderId: string, docId: string) {
  const orderRef = getFirebaseFirestore().doc(`shops/${shopId}/orders/${orderId}`);
  const snapshot = await orderRef.get();
  const documents = (snapshot.get("documents") ?? []) as StoredOrderDocument[];
  const document = documents.find((entry) => entry.docId === docId || entry.id === docId);
  if (!snapshot.exists || !document || document.shreddedAt) {
    return true;
  }

  try {
    if (document.storageBackend === "s3") {
      await deleteObject(document.storageKey);
    } else if (document.storageKey) {
      await rm(localPath(document.storageKey), { force: true });
    }
  } catch (error) {
    if (!isMissingObjectError(error)) {
      console.error("Failed to delete printed document", shopId, orderId, docId, error);
      return false;
    }
  }

  await getFirebaseFirestore().runTransaction(async (transaction) => {
    const fresh = await transaction.get(orderRef);
    const next = [...((fresh.get("documents") ?? []) as StoredOrderDocument[])];
    const index = next.findIndex((entry) => entry.docId === docId || entry.id === docId);
    if (!fresh.exists || index < 0 || next[index].shreddedAt) {
      return;
    }
    next[index] = { ...next[index], shreddedAt: new Date().toISOString() };
    // Not customer-visible, so this skips the single writer's tracking copy on purpose.
    transaction.update(orderRef, { documents: next, updatedAt: FieldValue.serverTimestamp() });
  });

  return true;
}
