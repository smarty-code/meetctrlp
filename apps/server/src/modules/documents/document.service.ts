import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createPresignedDownloadUrl, uploadObject } from "@ctrlp/firebase";
import { getFirebaseWebApiKey } from "@ctrlp/firebase/config";
import { FieldValue, getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import type { AuthSessionUser } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { createShopOrder, getShopOrder, type OrderDto } from "@/src/modules/orders/order.service";

const DOWNLOAD_TTL_SECONDS = 900;

export type StoredOrderDocument = {
  id: string;
  docId: string;
  storageKey: string;
  storageBackend: "s3" | "local";
  originalFilename: string;
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

function inspectPdf(bytes: Buffer) {
  if (bytes.length < 5 || bytes.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new AuthServiceError(400, "file is not a readable PDF");
  }

  const pageCount = bytes.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
  if (pageCount < 1) {
    throw new AuthServiceError(400, "PDF has no pages or is corrupted");
  }

  return {
    pageCount,
    fileSizeBytes: bytes.length,
    sha256Hash: createHash("sha256").update(bytes).digest("hex"),
  };
}

function localPath(storageKey: string) {
  return path.join(process.cwd(), "data", "print-jobs", storageKey);
}

async function storePdf(storageKey: string, bytes: Buffer) {
  try {
    await uploadObject(storageKey, bytes, "application/pdf");
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

async function writeAccessLog(input: {
  user: AuthSessionUser;
  orderId: string;
  docId: string;
  accessType: AccessType;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  const logId = randomUUID();
  await getFirebaseFirestore().doc(`accessLogs/${logId}`).set({
    logId,
    docId: input.docId,
    orderId: input.orderId,
    shopId: input.user.shopId,
    actorType: "SHOP_USER",
    actorId: input.user.id,
    accessType: input.accessType,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { logId };
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
  user: AuthSessionUser,
  files: Array<{ filename: string; bytes: Buffer; colorMode: "BW" | "COLOR"; paperSize: "A4" | "A3"; copies: number }>,
) {
  if (files.length < 1) {
    throw new AuthServiceError(400, "at least one PDF is required");
  }

  const inspected = files.map((file) => ({
    ...file,
    ...inspectPdf(file.bytes),
  }));
  const order = await createShopOrder(user, {
    paymentMethod: "CASH",
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
      storageKey: `uploads/${user.shopId}/${order.id}/${docId}.pdf`,
      storageBackend: "local" as const,
      originalFilename: file.filename,
      fileSizeBytes: file.fileSizeBytes,
      pageCount: file.pageCount,
      sha256Hash: file.sha256Hash,
      shreddedAt: null,
      bytes: file.bytes,
    };
  });

  const stored = [];
  for (const document of documents) {
    const storageBackend = await storePdf(document.storageKey, document.bytes);
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

export async function createDocumentDownloadUrl(
  user: AuthSessionUser,
  orderId: string,
  docId: string,
  origin: string,
) {
  const order = await getShopOrder(user, orderId);
  const document = findDocument(order, docId);
  if (!document.storageKey || !document.sha256Hash) {
    throw new AuthServiceError(404, "this document has no stored file");
  }

  if (document.storageBackend === "s3") {
    return {
      url: await createPresignedDownloadUrl(document.storageKey, DOWNLOAD_TTL_SECONDS),
      storageKey: document.storageKey,
      sha256Hash: document.sha256Hash,
      pageCount: document.pageCount,
      expiresIn: DOWNLOAD_TTL_SECONDS,
    };
  }

  const expiresAt = Date.now() + DOWNLOAD_TTL_SECONDS * 1000;
  const signature = signDownload(user.shopId, orderId, docId, expiresAt);
  const url = new URL(
    `/api/v1/shops/${user.shopId}/orders/${orderId}/documents/${docId}/content`,
    origin,
  );
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", signature);

  return {
    url: url.toString(),
    storageKey: document.storageKey,
    sha256Hash: document.sha256Hash,
    pageCount: document.pageCount,
    expiresIn: DOWNLOAD_TTL_SECONDS,
  };
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

  if (document.storageBackend === "s3") {
    throw new AuthServiceError(400, "download this document from its presigned url");
  }

  const bytes = await readFile(localPath(document.storageKey));
  return { bytes, filename: document.originalFilename, sha256Hash: document.sha256Hash };
}

export async function recordDocumentAccess(
  user: AuthSessionUser,
  orderId: string,
  docId: string,
  accessType: AccessType,
  request: Request,
) {
  await getShopOrder(user, orderId);
  findDocument(await getShopOrder(user, orderId), docId);
  return writeAccessLog({
    user,
    orderId,
    docId,
    accessType,
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });
}

export async function confirmDocumentShredded(
  user: AuthSessionUser,
  orderId: string,
  docId: string,
  request: Request,
) {
  const orderRef = getFirebaseFirestore().doc(`shops/${user.shopId}/orders/${orderId}`);
  await getFirebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orderRef);
    if (!snapshot.exists) {
      throw new AuthServiceError(404, "ORDER_NOT_FOUND");
    }

    const documents = [...((snapshot.get("documents") ?? []) as StoredOrderDocument[])];
    const index = documents.findIndex((entry) => entry.docId === docId || entry.id === docId);
    if (index < 0) {
      throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
    }

    documents[index] = {
      ...documents[index],
      shreddedAt: new Date().toISOString(),
    };
    transaction.update(orderRef, {
      documents,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAccessLog({
    user,
    orderId,
    docId,
    accessType: "SHREDDED",
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });

  return getShopOrder(user, orderId);
}
