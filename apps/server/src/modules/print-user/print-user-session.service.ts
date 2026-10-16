import { randomUUID } from "node:crypto";

import { FieldValue, getFirebaseFirestore } from "@ctrlp/firebase/firestore";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import type { GuestPrincipal } from "@/src/modules/print-user/print-user-cookie";
import { SESSION_TTL_MS, isSessionExpired } from "@/src/modules/print-user/print-user.helpers";
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
        createdAt: typeof document.createdAt === "string" ? document.createdAt : null,
      } satisfies GuestDocument,
    ];
  });
}

export function toSession(
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

/** Moves the session's end out to `expiresAt`. Called when the cookie is re-issued (at most hourly). */
export async function extendPrintUserSession(printUserId: string, expiresAt: Date) {
  await printUsersCollection().doc(printUserId).set(
    { lastSeenAt: FieldValue.serverTimestamp(), expiresAt },
    { merge: true },
  );
}

async function resumeSession(session: PrintUserSession) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await extendPrintUserSession(session.id, expiresAt);
  return { ...session, lastSeenAt: new Date().toISOString(), expiresAt: expiresAt.toISOString() };
}

/** What the guest's browser may see: no IP address and no storage keys (6.8). */
export function toPublicSession(session: PrintUserSession) {
  return {
    id: session.id,
    shopId: session.shopId,
    shopSlug: session.shopSlug,
    activeOrderId: session.activeOrderId,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
    // Undefined fields are dropped from the JSON response.
    documents: session.documents.map((document) => ({ ...document, storageKey: undefined })),
  };
}

/**
 * The guest is the browser holding the cookie. Its session resumes from any network. No cookie, a
 * cookie for another shop, or an ended session starts a new, empty cart. Nothing is looked up by
 * IP, so two visitors on one network (shop Wi-Fi, carrier NAT) never share a cart. `ipAddress` is
 * recorded on a new session for abuse logging only.
 */
export async function createOrResumePrintUserSession(input: {
  shopId: string;
  shopSlug: string;
  ipAddress: string;
  cookiePrintUserId?: string;
}) {
  if (input.cookiePrintUserId) {
    const existing = await getPrintUserSession(input.cookiePrintUserId);
    if (existing && existing.shopId === input.shopId && !isSessionExpired(existing.expiresAt)) {
      return resumeSession(existing);
    }
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

/**
 * The guest's session document, for actions that need the cart (one read). The signed cookie already
 * proved who is calling, from which network; this checks the session still exists.
 */
export async function loadGuestSession(guest: GuestPrincipal) {
  const session = await getPrintUserSession(guest.id);
  if (!session || session.shopId !== guest.shopId) {
    throw new AuthServiceError(401, "guest session not found");
  }
  if (isSessionExpired(session.expiresAt)) {
    throw new AuthServiceError(401, "guest session expired");
  }
  return session;
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

/**
 * Atomically read-modify-write guest documents (safe for parallel upload intents). Returning the
 * same `documents` array unchanged skips the write.
 */
export async function mutatePrintUserDocuments<T>(
  printUserId: string,
  mutate: (documents: GuestDocument[]) => { documents: GuestDocument[]; result: T },
): Promise<T> {
  const ref = printUsersCollection().doc(printUserId);

  return getFirebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw new AuthServiceError(401, "guest session not found");
    }

    const session = toSession(snapshot);
    const { documents: nextDocuments, result } = mutate(session.documents);
    if (nextDocuments === session.documents) {
      return result;
    }

    transaction.set(
      ref,
      {
        documents: nextDocuments,
        lastSeenAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
      { merge: true },
    );

    return result;
  }, { maxAttempts: 10 });
}
