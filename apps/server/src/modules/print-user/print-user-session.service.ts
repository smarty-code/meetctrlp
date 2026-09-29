import { randomUUID } from "node:crypto";

import { FieldValue } from "@ctrlp/firebase/firestore";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import {
  SESSION_TTL_MS,
  isSessionExpired,
} from "@/src/modules/print-user/print-user.helpers";
import { printUsersCollection, timestampToIso } from "@/src/modules/print-user/print-user-shop.service";
import type { GuestDocument, PrintUserSession } from "@/src/modules/print-user/print-user.types";

function parseDocuments(value: unknown): GuestDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const document = entry as Record<string, unknown>;
    if (typeof document.id !== "string" || typeof document.originalFilename !== "string") {
      return [];
    }
    const mimeType = document.mimeType;
    if (mimeType !== "application/pdf" && mimeType !== "image/jpeg" && mimeType !== "image/png") {
      return [];
    }
    const config =
      document.config && typeof document.config === "object"
        ? (document.config as Record<string, unknown>)
        : {};

    return [
      {
        id: document.id,
        originalFilename: document.originalFilename,
        mimeType,
        fileSizeBytes: typeof document.fileSizeBytes === "number" ? document.fileSizeBytes : 0,
        pageCount: typeof document.pageCount === "number" ? document.pageCount : null,
        sha256Hash: typeof document.sha256Hash === "string" ? document.sha256Hash : null,
        storageKey: typeof document.storageKey === "string" ? document.storageKey : "",
        status:
          document.status === "READY" || document.status === "FAILED" || document.status === "UPLOADING"
            ? document.status
            : "UPLOADING",
        config: {
          colorMode: config.colorMode === "COLOR" ? "COLOR" : "BW",
          copies: typeof config.copies === "number" && config.copies > 0 ? config.copies : 1,
          paperSize: config.paperSize === "A3" ? "A3" : "A4",
          pageSelection: typeof config.pageSelection === "string" ? config.pageSelection : "all",
          billablePages: typeof config.billablePages === "number" ? config.billablePages : 1,
          orientation: config.orientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT",
        },
      } satisfies GuestDocument,
    ];
  });
}

function toSession(
  snapshot: { id: string; data: () => Record<string, unknown> | undefined },
): PrintUserSession {
  const data = snapshot.data() ?? {};
  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    shopId: typeof data.shopId === "string" ? data.shopId : "",
    shopSlug: typeof data.shopSlug === "string" ? data.shopSlug : "",
    ipAddress: typeof data.ipAddress === "string" ? data.ipAddress : "",
    documents: parseDocuments(data.documents),
    activeOrderId: typeof data.activeOrderId === "string" ? data.activeOrderId : null,
    createdAt: timestampToIso(data.createdAt),
    lastSeenAt: timestampToIso(data.lastSeenAt),
    expiresAt: timestampToIso(data.expiresAt),
  };
}

export async function getPrintUserSession(printUserId: string) {
  const snapshot = await printUsersCollection().doc(printUserId).get();
  if (!snapshot.exists) {
    return undefined;
  }
  return toSession(snapshot);
}

async function findResumableSession(shopId: string, ipAddress: string) {
  const now = new Date();
  const snapshot = await printUsersCollection()
    .where("shopId", "==", shopId)
    .where("ipAddress", "==", ipAddress)
    .where("expiresAt", ">", now)
    .orderBy("expiresAt", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return undefined;
  }

  return toSession(snapshot.docs[0]);
}

async function touchSession(session: PrintUserSession) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await printUsersCollection().doc(session.id).set(
    {
      lastSeenAt: FieldValue.serverTimestamp(),
      expiresAt,
    },
    { merge: true },
  );
  return {
    ...session,
    lastSeenAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function createOrResumePrintUserSession(input: {
  shopId: string;
  shopSlug: string;
  ipAddress: string;
  cookiePrintUserId?: string;
}) {
  if (input.cookiePrintUserId) {
    const existing = await getPrintUserSession(input.cookiePrintUserId);
    if (
      existing &&
      existing.shopId === input.shopId &&
      existing.ipAddress === input.ipAddress &&
      !isSessionExpired(existing.expiresAt)
    ) {
      return touchSession(existing);
    }
  }

  const resumed = await findResumableSession(input.shopId, input.ipAddress);
  if (resumed && resumed.shopId === input.shopId) {
    return touchSession(resumed);
  }

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const now = FieldValue.serverTimestamp();
  await printUsersCollection().doc(id).set({
    id,
    shopId: input.shopId,
    shopSlug: input.shopSlug,
    ipAddress: input.ipAddress,
    documents: [],
    activeOrderId: null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });

  return {
    id,
    shopId: input.shopId,
    shopSlug: input.shopSlug,
    ipAddress: input.ipAddress,
    documents: [],
    activeOrderId: null,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  } satisfies PrintUserSession;
}

export async function requireValidPrintUserSession(printUserId: string, ipAddress: string) {
  const session = await getPrintUserSession(printUserId);
  if (!session) {
    throw new AuthServiceError(401, "guest session not found");
  }
  if (session.ipAddress !== ipAddress) {
    throw new AuthServiceError(401, "guest session does not match this network");
  }
  if (isSessionExpired(session.expiresAt)) {
    throw new AuthServiceError(401, "guest session expired");
  }
  return touchSession(session);
}

export async function savePrintUserDocuments(printUserId: string, documents: GuestDocument[]) {
  await printUsersCollection().doc(printUserId).set(
    {
      documents,
      lastSeenAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function setPrintUserActiveOrder(printUserId: string, orderId: string) {
  await printUsersCollection().doc(printUserId).set(
    {
      activeOrderId: orderId,
      lastSeenAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
