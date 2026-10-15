import {
  createPresignedUploadUrl,
  deleteObject,
  getObjectSize,
  isMissingObjectError,
  readObject,
} from "@ctrlp/firebase";
import type {
  PrintUserBatchConfigurationInput,
  PrintUserPrintConfigurationInput,
  PrintUserSubmitOrderRequestInput,
  PrintUserUploadIntentRequestInput,
} from "@ctrlp/schemas";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { inspectDocument } from "@/src/modules/documents/inspect-document";
import {
  confirmOnlinePayment,
  createPrintUserOrder,
  findPrintUserOrderByIdempotencyKey,
  getShopOrderById,
} from "@/src/modules/orders/order.service";
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
  normalizeMimeType,
  officeFormatMessage,
  pageSelectionValue,
} from "@/src/modules/print-user/print-user.helpers";
import {
  checkoutPrintUserDocuments,
  getPrintUserSession,
  mutatePrintUserDocuments,
} from "@/src/modules/print-user/print-user-session.service";
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

async function removeGuestDocument(printUserId: string, document: GuestDocument) {
  await deleteStoredObjects([document]);
  await mutatePrintUserDocuments(printUserId, (documents) => ({
    documents: documents.filter((entry) => entry.id !== document.id),
    result: undefined,
  }));
}

export async function createUploadIntent(session: PrintUserSession, input: PrintUserUploadIntentRequestInput) {
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
    await removeGuestDocument(session.id, document).catch(() => undefined);
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

export async function completeGuestDocument(session: PrintUserSession, docId: string) {
  const current = await getPrintUserSession(session.id);
  if (!current) {
    throw new AuthServiceError(401, "guest session not found");
  }

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
    await removeGuestDocument(session.id, document).catch(() => undefined);
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
    await removeGuestDocument(session.id, document).catch(() => undefined);
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

export async function deleteGuestDocument(session: PrintUserSession, docId: string) {
  await removeGuestDocument(session.id, requireDocument(session, docId));
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
    pageSelection: pageSelectionValue(input.pageSelection.mode, input.pageSelection.expression, []),
    billablePages: billed,
    orientation: input.orientation ?? document.config.orientation,
  };
}

export async function updateGuestDocumentConfiguration(
  session: PrintUserSession,
  docId: string,
  input: PrintUserPrintConfigurationInput,
) {
  const [updated] = await updateGuestDocumentConfigurations(session, [{ ...input, documentId: docId }]);
  return updated;
}

/** Validates and saves settings for several cart documents in a single transaction. */
export async function updateGuestDocumentConfigurations(
  session: PrintUserSession,
  inputs: PrintUserBatchConfigurationInput["documents"],
) {
  const config = await getShopConfigByShopId(session.shopId);
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

export async function quoteGuestSession(session: PrintUserSession) {
  const config = await getShopConfigByShopId(session.shopId);
  const ready = session.documents.filter((document) => document.status === "READY" && document.pageCount);
  const items = ready.map((document) => {
    const billed = document.config.billablePages || document.pageCount || 1;
    const quote = quoteDocumentPrint(config, {
      billablePages: billed,
      copies: document.config.copies,
      colorMode: document.config.colorMode,
      paperSize: document.config.paperSize,
    });
    return {
      documentId: document.id,
      documentName: document.originalFilename,
      billablePages: billed,
      copies: document.config.copies,
      colorMode: document.config.colorMode,
      paperSize: document.config.paperSize,
      unitPricePaise: quote.unitPricePaise,
      totalPaise: quote.totalPaise,
    };
  });
  const totalPaise = items.reduce((sum, item) => sum + item.totalPaise, 0);

  return {
    currency: "INR" as const,
    items,
    totalPaise,
    totalSelectedPages: items.reduce((sum, item) => sum + item.billablePages * item.copies, 0),
    totalCopies: items.reduce((sum, item) => sum + item.copies, 0),
  };
}

function quoteFromOrder(order: Awaited<ReturnType<typeof createPrintUserOrder>>) {
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

export async function submitGuestOrder(session: PrintUserSession, input: PrintUserSubmitOrderRequestInput) {
  // A retried submit must return the original order even though checkout emptied the cart.
  const placed = await findPrintUserOrderByIdempotencyKey(session.shopId, session.id, input.idempotencyKey);
  if (placed) {
    // Also covers a first attempt that created the order but failed before clearing the cart.
    await checkoutPrintUserDocuments(
      session.id,
      placed.id,
      placed.documents.map((document) => document.id),
    );
    return { priceChanged: false as const, quote: quoteFromOrder(placed), order: placed };
  }

  const ready = session.documents.filter((document) => document.status === "READY" && document.pageCount);
  const submitCheck = canSubmitGuestDocuments(ready);
  if (!submitCheck.ok) {
    throw new AuthServiceError(400, submitCheck.reason);
  }

  const quote = await quoteGuestSession(session);
  if (
    typeof input.expectedTotalPaise === "number" &&
    input.expectedTotalPaise !== quote.totalPaise
  ) {
    return {
      priceChanged: true as const,
      quote,
      order: null,
    };
  }

  const order = await createPrintUserOrder({
    shopId: session.shopId,
    printUserId: session.id,
    paymentMethod: input.paymentMethod,
    idempotencyKey: input.idempotencyKey,
    documents: ready.map((document) => ({
      id: document.id,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      fileSizeBytes: document.fileSizeBytes,
      pageCount: document.pageCount ?? 1,
      sha256Hash: document.sha256Hash ?? "",
      storageKey: document.storageKey,
      copies: document.config.copies,
      colorMode: document.config.colorMode,
      paperSize: document.config.paperSize,
      pageSelection: document.config.pageSelection,
      billablePages: document.config.billablePages || document.pageCount || 1,
    })),
  });

  if (order.printUserId !== session.id) {
    // createPrintUserOrder replays by key alone; never hand back another guest's order.
    throw new AuthServiceError(409, "IDEMPOTENCY_KEY_REUSED");
  }

  await checkoutPrintUserDocuments(
    session.id,
    order.id,
    ready.map((document) => document.id),
  );
  return { priceChanged: false as const, quote, order };
}

export async function getGuestOrder(session: PrintUserSession, orderId: string) {
  if (session.activeOrderId && session.activeOrderId !== orderId) {
    throw new AuthServiceError(403, "this order does not belong to the guest session");
  }
  const order = await getShopOrderById(session.shopId, orderId);
  if (order.printUserId !== session.id) {
    throw new AuthServiceError(403, "this order does not belong to the guest session");
  }
  return order;
}

export async function mockConfirmGuestPayment(session: PrintUserSession, orderId: string, idempotencyKey: string) {
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
