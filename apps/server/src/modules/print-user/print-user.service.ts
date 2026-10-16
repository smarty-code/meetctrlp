import {
  createPresignedUploadUrl,
  deleteObject,
  getObjectSize,
  isMissingObjectError,
  readObject,
} from "@ctrlp/firebase";
import { FieldValue, getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import { parsePageSelection as parseSharedPageSelection } from "@ctrlp/schemas/page-selection";
import type {
  PrintUserBatchConfigurationInput,
  PrintUserDeleteDocumentResponse,
  PrintUserClearCartResponse,
  PrintUserPrintConfigurationInput,
  PrintUserSubmitOrderRequestInput,
  PrintUserUploadIntentRequestInput,
} from "@ctrlp/schemas";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { trackingCopy } from "@/src/modules/orders/order-model";
import { inspectDocument } from "@/src/modules/documents/inspect-document";
import { shredAllOrderDocuments } from "@/src/modules/documents/document.service";
import {
  cancelUnpaidOrder,
  confirmOnlinePayment,
  getShopOrderById,
  pricePrintUserDocuments,
  writePrintUserOrder,
  type OrderDto,
  type PricedPrintUserOrder,
  type PrintUserCheckoutDocument,
} from "@/src/modules/orders/order.service";
import { ringShop } from "@/src/modules/realtime/doorbell";
import { getShopConfigByShopId, quoteDocumentPrint } from "@/src/modules/shops/shop-config.service";
import {
  MAX_FILE_BYTES,
  MAX_GUEST_FILES,
  PRESIGN_TTL_SECONDS,
  billablePages,
  canMockConfirmPayment,
  mockPaymentsAllowed,
  canSubmitGuestDocuments,
  guestStorageKey,
  isAbandonedUpload,
  isPageSelectionValid,
  isSessionExpired,
  normalizeMimeType,
  officeFormatMessage,
  pageSelectionValue,
} from "@/src/modules/print-user/print-user.helpers";
import {
  loadGuestSession,
  mutatePrintUserDocuments,
  toSession,
} from "@/src/modules/print-user/print-user-session.service";
import { printUsersCollection } from "@/src/modules/print-user/print-user-shop.service";
import type { GuestPrincipal } from "@/src/modules/print-user/print-user-cookie";
import type { GuestDocument, PrintUserSession } from "@/src/modules/print-user/print-user.types";
import { randomUUID } from "node:crypto";

function defaultConfig(pageCount: number): GuestDocument["config"] {
  return {
    colorMode: "BW",
    copies: 1,
    paperSize: "A4",
    pageSelection: "all",
    billablePages: Math.max(1, pageCount),
    orientation: "PORTRAIT",
  };
}

function requireDocument(session: PrintUserSession, docId: string) {
  const document = session.documents.find((entry) => entry.id === docId);
  if (!document) {
    throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
  }
  return document;
}

async function deleteStoredObjects(documents: GuestDocument[]) {
  // Best effort: the cart entry is what holds a slot; a leftover object is only storage.
  await Promise.allSettled(
    documents.filter((document) => document.storageKey).map((document) => deleteObject(document.storageKey)),
  );
}

/**
 * Takes one document out of the cart, then deletes its file. The cart entry goes first, in a
 * transaction, and the file only if that entry was still there. Checkout moves entries into the
 * order in its own transaction, so a file that an order needs is never deleted from here.
 */
async function removeGuestDocument(printUserId: string, docId: string) {
  const removed = await mutatePrintUserDocuments(printUserId, (documents) => {
    const target = documents.find((entry) => entry.id === docId);
    return {
      documents: target ? documents.filter((entry) => entry.id !== docId) : documents,
      result: target ?? null,
    };
  });
  if (removed) {
    await deleteStoredObjects([removed]);
  }
  return removed;
}

export async function createUploadIntent(session: GuestPrincipal, input: PrintUserUploadIntentRequestInput) {
  const officeMessage = officeFormatMessage(input.originalFilename);
  if (officeMessage) {
    throw new AuthServiceError(400, officeMessage);
  }

  const mimeType = normalizeMimeType(input.mimeType, input.originalFilename);
  if (!mimeType) {
    throw new AuthServiceError(400, "unsupported file type. Upload a PDF, JPEG, or PNG.");
  }
  if (input.fileSizeBytes > MAX_FILE_BYTES) {
    throw new AuthServiceError(400, "file exceeds the 50MB limit");
  }

  const now = new Date();
  const docId = randomUUID();
  const storageKey = guestStorageKey(session.shopId, session.id, docId, mimeType);
  const document: GuestDocument = {
    id: docId,
    originalFilename: input.originalFilename,
    mimeType,
    fileSizeBytes: input.fileSizeBytes,
    pageCount: null,
    sha256Hash: null,
    storageKey,
    status: "UPLOADING",
    config: defaultConfig(1),
    createdAt: now.toISOString(),
  };

  const abandoned = await mutatePrintUserDocuments(session.id, (documents) => {
    const live = documents.filter((entry) => !isAbandonedUpload(entry, now));
    if (live.length >= MAX_GUEST_FILES) {
      throw new AuthServiceError(400, `you can upload up to ${MAX_GUEST_FILES} documents per order`);
    }
    return {
      documents: [...live, document],
      result: documents.filter((entry) => isAbandonedUpload(entry, now)),
    };
  });
  await deleteStoredObjects(abandoned);

  let uploadUrl: string;
  try {
    uploadUrl = await createPresignedUploadUrl(storageKey, mimeType, PRESIGN_TTL_SECONDS);
  } catch (error) {
    await removeGuestDocument(session.id, document.id).catch(() => undefined);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Missing required environment variable")) {
      throw new AuthServiceError(503, "document storage is not configured");
    }
    throw error;
  }

  return {
    document,
    uploadUrl,
    storageKey,
    expiresIn: PRESIGN_TTL_SECONDS,
  };
}

export async function completeGuestDocument(session: GuestPrincipal, docId: string) {
  // The one read of this request; the write below is its own transaction.
  const current = await loadGuestSession(session);

  const document = requireDocument(current, docId);
  if (document.status === "READY" && document.pageCount) {
    return document;
  }

  // A missing object is the client's to fix (400). Any other storage failure is rethrown as a 500,
  // which the web app retries, so a transient outage does not throw away a finished upload.
  const missingUpload = (error: unknown) => {
    if (isMissingObjectError(error)) {
      return new AuthServiceError(400, "upload was not found. Retry the file upload.");
    }
    return error;
  };

  // Check the size before downloading. A presigned PUT does not cap the body, and buffering an
  // oversized object would exhaust the memory of a serverless instance and every request on it.
  let storedBytes: number;
  try {
    storedBytes = await getObjectSize(document.storageKey);
  } catch (error) {
    throw missingUpload(error);
  }
  if (storedBytes > MAX_FILE_BYTES) {
    await removeGuestDocument(session.id, document.id).catch(() => undefined);
    throw new AuthServiceError(400, "file exceeds the 50MB limit");
  }

  let bytes: Buffer;
  try {
    const body = await readObject(document.storageKey);
    // A view over the downloaded bytes, not a copy, so a 50 MB file costs 50 MB of memory, not 100.
    bytes = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  } catch (error) {
    throw missingUpload(error);
  }

  let inspected: ReturnType<typeof inspectDocument>;
  try {
    if (bytes.length > MAX_FILE_BYTES) {
      throw new AuthServiceError(400, "file exceeds the 50MB limit");
    }
    inspected = inspectDocument(bytes, document.mimeType);
  } catch (error) {
    // An unreadable file can never become printable, so free its cart slot right away.
    await removeGuestDocument(session.id, document.id).catch(() => undefined);
    throw error;
  }

  const ready: GuestDocument = {
    ...document,
    fileSizeBytes: inspected.fileSizeBytes,
    pageCount: inspected.pageCount,
    sha256Hash: inspected.sha256Hash,
    status: "READY",
    config: defaultConfig(inspected.pageCount),
  };

  return mutatePrintUserDocuments(session.id, (documents) => {
    const existing = documents.find((entry) => entry.id === docId);
    if (!existing) {
      throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
    }
    if (existing.status === "READY" && existing.pageCount) {
      return { documents, result: existing };
    }
    return {
      documents: documents.map((entry) => (entry.id === docId ? ready : entry)),
      result: ready,
    };
  });
}

/** 409 `ALREADY_ORDERED` when `docId` left the cart in the guest's latest order. */
async function assertNotOrdered(guest: GuestPrincipal, docId: string) {
  const { activeOrderId } = await loadGuestSession(guest);
  if (!activeOrderId) {
    return;
  }
  let order: OrderDto;
  try {
    order = await getShopOrderById(guest.shopId, activeOrderId);
  } catch (error) {
    if (error instanceof AuthServiceError && error.status === 404) {
      return;
    }
    throw error;
  }
  if (order.printUserId === guest.id && order.documents.some((entry) => entry.id === docId)) {
    throw new AuthServiceError(409, "ALREADY_ORDERED");
  }
}

/**
 * Deletes a cart document. Idempotent: a document that is already gone is `removed: false`. One that
 * has been ordered is a 409 `ALREADY_ORDERED`, so the page can say so instead of hiding it.
 */
export async function deleteGuestDocument(
  guest: GuestPrincipal,
  docId: string,
): Promise<PrintUserDeleteDocumentResponse> {
  if (await removeGuestDocument(guest.id, docId)) {
    return { ok: true, removed: true };
  }
  await assertNotOrdered(guest, docId);
  return { ok: true, removed: false };
}

/**
 * Empties the cart: every entry (ready, uploading or failed) in one transaction, then their files.
 * A placed order is not touched; its documents already left the cart at checkout.
 */
export async function clearGuestCart(guest: GuestPrincipal): Promise<PrintUserClearCartResponse> {
  const removed = await mutatePrintUserDocuments(guest.id, (documents) => ({
    documents: documents.length > 0 ? [] : documents,
    result: documents,
  }));
  await deleteStoredObjects(removed);
  return { ok: true, removed: removed.length };
}

function resolveDocumentConfiguration(
  document: GuestDocument,
  input: PrintUserPrintConfigurationInput,
  config: Awaited<ReturnType<typeof getShopConfigByShopId>>,
): GuestDocument["config"] {
  if (document.status !== "READY" || !document.pageCount) {
    throw new AuthServiceError(409, "document is still uploading");
  }

  if (input.colorMode === "COLOR" && !config.capabilities.colorPrinting) {
    throw new AuthServiceError(400, "this shop does not offer color printing");
  }
  if (input.paperSize === "A3" && !config.capabilities.a3Printing) {
    throw new AuthServiceError(400, "this shop does not offer A3 printing");
  }

  const pageCount = document.pageCount;
  if (input.pageSelection.mode === "selected" && !isPageSelectionValid(input.pageSelection.expression, pageCount)) {
    throw new AuthServiceError(400, `use valid pages from 1 to ${pageCount}, such as 1,3,5-8`);
  }

  const billed = billablePages(pageCount, input.pageSelection.mode, input.pageSelection.expression);
  if (billed < 1) {
    throw new AuthServiceError(400, "select at least one page to print");
  }

  quoteDocumentPrint(config, {
    billablePages: billed,
    copies: input.copies,
    colorMode: input.colorMode,
    paperSize: input.paperSize,
  });

  return {
    colorMode: input.colorMode,
    copies: input.copies,
    paperSize: input.paperSize,
    pageSelection: pageSelectionValue(input.pageSelection.mode, input.pageSelection.expression, pageCount),
    billablePages: billed,
    orientation: input.orientation ?? document.config.orientation,
  };
}

export async function updateGuestDocumentConfiguration(
  session: GuestPrincipal,
  docId: string,
  input: PrintUserPrintConfigurationInput,
) {
  const [updated] = await updateGuestDocumentConfigurations(session, [{ ...input, documentId: docId }]);
  return updated;
}

/** Validates and saves settings for several cart documents in a single transaction. */
export async function updateGuestDocumentConfigurations(
  guest: GuestPrincipal,
  inputs: PrintUserBatchConfigurationInput["documents"],
) {
  const [session, config] = await Promise.all([loadGuestSession(guest), getShopConfigByShopId(guest.shopId)]);
  const configs = new Map(
    inputs.map((input) => [
      input.documentId,
      resolveDocumentConfiguration(requireDocument(session, input.documentId), input, config),
    ]),
  );

  return mutatePrintUserDocuments(session.id, (documents) => {
    for (const docId of configs.keys()) {
      if (!documents.some((entry) => entry.id === docId)) {
        throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
      }
    }
    const next = documents.map((entry) => {
      const updatedConfig = configs.get(entry.id);
      return updatedConfig ? { ...entry, config: updatedConfig } : entry;
    });
    return {
      documents: next,
      result: next.filter((entry) => configs.has(entry.id)),
    };
  });
}

export async function quoteGuestSession(guest: GuestPrincipal) {
  return quoteSessionDocuments(await loadGuestSession(guest));
}

function toCheckoutDocument(document: GuestDocument): PrintUserCheckoutDocument {
  const pageCount = document.pageCount ?? 1;
  // Read with the printer's grammar, so the pages billed are the pages that print. A selection
  // saved before that grammar was strict can fail here; the guest fixes it on the customize page.
  const selection = parseSharedPageSelection(document.config.pageSelection, pageCount);
  if (!selection.ok) {
    throw new AuthServiceError(
      400,
      `${document.originalFilename}: use valid pages from 1 to ${pageCount}, such as 1,3,5-8`,
    );
  }
  return {
    id: document.id,
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    fileSizeBytes: document.fileSizeBytes,
    pageCount,
    sha256Hash: document.sha256Hash ?? "",
    storageKey: document.storageKey,
    copies: document.config.copies,
    colorMode: document.config.colorMode,
    paperSize: document.config.paperSize,
    orientation: document.config.orientation,
    pageSelection: selection.canonical,
    billablePages: selection.pages.length,
  };
}

/** The quote for priced order lines, so the cart quote and the order are priced by one function. */
function quoteFromLines({ lines, subtotalMinorUnits }: PricedPrintUserOrder) {
  const items = lines.map(({ document }) => ({
    documentId: document.id,
    documentName: document.originalFilename,
    billablePages: document.config.billablePages,
    copies: document.copies,
    colorMode: document.colorMode,
    paperSize: document.paperSize,
    unitPricePaise: document.unitPricePaise,
    totalPaise: document.totalPaise,
  }));
  return {
    currency: "INR" as const,
    items,
    totalPaise: subtotalMinorUnits,
    totalSelectedPages: items.reduce((sum, item) => sum + item.billablePages * item.copies, 0),
    totalCopies: items.reduce((sum, item) => sum + item.copies, 0),
  };
}

async function quoteSessionDocuments(session: PrintUserSession) {
  const config = await getShopConfigByShopId(session.shopId);
  const ready = session.documents.filter((document) => document.status === "READY" && document.pageCount);
  return quoteFromLines(pricePrintUserDocuments(config, ready.map(toCheckoutDocument)));
}

function quoteFromOrder(order: OrderDto) {
  const items = order.documents.map((document) => {
    const billed = document.config?.billablePages || document.pageCount || 1;
    return {
      documentId: document.id,
      documentName: document.originalFilename,
      billablePages: billed,
      copies: document.copies,
      colorMode: document.colorMode,
      paperSize: document.paperSize,
      unitPricePaise: document.unitPricePaise,
      totalPaise: document.totalPaise,
    };
  });
  return {
    currency: "INR" as const,
    items,
    totalPaise: order.amounts.totalMinorUnits,
    totalSelectedPages: items.reduce((sum, item) => sum + item.billablePages * item.copies, 0),
    totalCopies: items.reduce((sum, item) => sum + item.copies, 0),
  };
}

/**
 * Places the guest's order from their cart. One transaction writes the order and empties the cart,
 * so a document is always in exactly one of them: a delete or clear racing this checkout either
 * lands first (and the document is not ordered) or finds the entry gone (and leaves its file alone).
 */
export async function submitGuestOrder(guest: GuestPrincipal, input: PrintUserSubmitOrderRequestInput) {
  const db = getFirebaseFirestore();
  const config = await getShopConfigByShopId(guest.shopId);
  const keyRef = db.doc(`shops/${guest.shopId}/idempotencyKeys/${input.idempotencyKey}`);
  const shopRef = db.doc(`shops/${guest.shopId}`);
  const cartRef = printUsersCollection().doc(guest.id);
  const orderId = randomUUID();

  const outcome = await db.runTransaction(async (transaction) => {
    const [keySnap, shopSnap, cartSnap] = await Promise.all([
      transaction.get(keyRef),
      transaction.get(shopRef),
      transaction.get(cartRef),
    ]);

    // A retried submit returns the original order, though checkout has emptied the cart since.
    if (keySnap.exists) {
      const placedOrderId = keySnap.get("orderId");
      if (keySnap.get("action") === "print-user-submit" && typeof placedOrderId === "string") {
        return { kind: "replay" as const, orderId: placedOrderId };
      }
      throw new AuthServiceError(409, "IDEMPOTENCY_KEY_REUSED");
    }
    if (!shopSnap.exists) {
      throw new AuthServiceError(404, "shop not found");
    }
    const cart = cartSnap.exists ? toSession(cartSnap) : null;
    if (!cart || cart.shopId !== guest.shopId) {
      throw new AuthServiceError(401, "guest session not found");
    }
    if (isSessionExpired(cart.expiresAt)) {
      throw new AuthServiceError(401, "guest session expired");
    }

    const now = new Date();
    const live = cart.documents.filter((entry) => !isAbandonedUpload(entry, now));
    const submitCheck = canSubmitGuestDocuments(live);
    if (!submitCheck.ok) {
      throw new AuthServiceError(submitCheck.status, submitCheck.reason);
    }

    const priced = pricePrintUserDocuments(config, live.map(toCheckoutDocument));
    const quote = quoteFromLines(priced);
    if (typeof input.expectedTotalPaise === "number" && input.expectedTotalPaise !== quote.totalPaise) {
      return { kind: "priceChanged" as const, quote };
    }

    writePrintUserOrder(transaction, shopSnap, {
      orderId,
      shopId: guest.shopId,
      printUserId: guest.id,
      paymentMethod: input.paymentMethod,
      idempotencyKey: input.idempotencyKey,
      priced,
    });
    // Abandoned uploads leave with the ordered documents; their files are deleted after commit.
    transaction.set(
      cartRef,
      {
        documents: [],
        activeOrderId: orderId,
        lastSeenAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return {
      kind: "placed" as const,
      quote,
      abandoned: cart.documents.filter((entry) => isAbandonedUpload(entry, now)),
    };
  }, { maxAttempts: 10 });

  if (outcome.kind === "priceChanged") {
    return { priceChanged: true as const, quote: outcome.quote, order: null };
  }

  if (outcome.kind === "replay") {
    const placed = await getShopOrderById(guest.shopId, outcome.orderId);
    if (placed.printUserId !== guest.id) {
      // Never hand back another guest's order for a reused key.
      throw new AuthServiceError(409, "IDEMPOTENCY_KEY_REUSED");
    }
    return { priceChanged: false as const, quote: quoteFromOrder(placed), order: placed };
  }

  await deleteStoredObjects(outcome.abandoned);
  const order = await getShopOrderById(guest.shopId, orderId);
  // An online order stays off the shop's board until it is paid, and the payment rings then.
  if (input.paymentMethod === "CASH") {
    await ringShop(guest.shopId, { work: false, event: "order_submitted", orderId, orderNumber: order.orderNumber });
  }
  return { priceChanged: false as const, quote: outcome.quote, order };
}

/**
 * The guest withdraws their order before the shop takes it on: allowed while it is SUBMITTED and
 * unpaid (409 `ORDER_NOT_CANCELLABLE` or `ORDER_ALREADY_PAID` otherwise). Its files are deleted
 * right away, since nothing will print them. Returns the customer-safe tracking view.
 */
export async function cancelGuestOrder(guest: GuestPrincipal, orderId: string) {
  const { order } = await cancelUnpaidOrder(guest.shopId, orderId, {
    reason: "GUEST_CANCELLED",
    printUserId: guest.id,
  });
  await shredAllOrderDocuments(guest.shopId, orderId);
  return { ...trackingCopy(order), updatedAt: order.updatedAt };
}

export async function getGuestOrder(session: GuestPrincipal, orderId: string) {
  const order = await getShopOrderById(session.shopId, orderId);
  if (order.printUserId !== session.id) {
    throw new AuthServiceError(403, "this order does not belong to the guest session");
  }
  return order;
}

/**
 * The customer-safe view of a guest order, the same shape as its `orderTracking` copy: the tracking
 * page reads this once when its live listener is unavailable (TRAFFIC_SCALING_V2 6.8).
 */
export async function getGuestOrderTracking(guest: GuestPrincipal, orderId: string) {
  const order = await getGuestOrder(guest, orderId);
  return { ...trackingCopy(order), updatedAt: order.updatedAt };
}

export async function mockConfirmGuestPayment(session: GuestPrincipal, orderId: string, idempotencyKey: string) {
  if (!mockPaymentsAllowed()) {
    throw new AuthServiceError(404, "not found");
  }
  const order = await getGuestOrder(session, orderId);
  const allowed = canMockConfirmPayment(order);
  if (!allowed.ok && allowed.reason !== "ORDER_NOT_ONLINE") {
    throw new AuthServiceError(409, allowed.reason);
  }
  if (!allowed.ok) {
    throw new AuthServiceError(409, allowed.reason);
  }

  const { order: paid } = await confirmOnlinePayment(session.shopId, orderId, {
    paymentReference: `mock-${orderId}`,
    idempotencyKey,
  });
  return paid;
}
