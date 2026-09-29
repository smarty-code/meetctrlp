import {
  createPresignedUploadUrl,
  deleteObject,
  readObject,
} from "@ctrlp/firebase";
import type {
  PrintUserPrintConfigurationInput,
  PrintUserSubmitOrderRequestInput,
  PrintUserUploadIntentRequestInput,
} from "@ctrlp/schemas";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { inspectDocument } from "@/src/modules/documents/inspect-document";
import {
  confirmOnlinePayment,
  createPrintUserOrder,
  getShopOrderById,
} from "@/src/modules/orders/order.service";
import { queueIncomingOrder } from "@/src/modules/printing/print-job.service";
import { getShopConfigByShopId, quoteDocumentPrint } from "@/src/modules/shops/shop-config.service";
import {
  MAX_FILE_BYTES,
  MAX_GUEST_FILES,
  PRESIGN_TTL_SECONDS,
  billablePages,
  canMockConfirmPayment,
  canSubmitGuestDocuments,
  guestStorageKey,
  isPageSelectionValid,
  normalizeMimeType,
  officeFormatMessage,
  pageSelectionValue,
} from "@/src/modules/print-user/print-user.helpers";
import {
  savePrintUserDocuments,
  setPrintUserActiveOrder,
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

  const active = session.documents.filter((document) => document.status !== "FAILED");
  if (active.length >= MAX_GUEST_FILES) {
    throw new AuthServiceError(400, "you can upload up to 10 documents per order");
  }

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
  };

  await savePrintUserDocuments(session.id, [...session.documents, document]);

  let uploadUrl: string;
  try {
    uploadUrl = await createPresignedUploadUrl(storageKey, mimeType, PRESIGN_TTL_SECONDS);
  } catch (error) {
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
  const document = requireDocument(session, docId);
  if (document.status === "READY" && document.pageCount) {
    return document;
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await readObject(document.storageKey));
  } catch {
    throw new AuthServiceError(400, "upload was not found. Retry the file upload.");
  }

  if (bytes.length > MAX_FILE_BYTES) {
    throw new AuthServiceError(400, "file exceeds the 50MB limit");
  }

  const inspected = inspectDocument(bytes, document.mimeType);
  const ready: GuestDocument = {
    ...document,
    fileSizeBytes: inspected.fileSizeBytes,
    pageCount: inspected.pageCount,
    sha256Hash: inspected.sha256Hash,
    status: "READY",
    config: defaultConfig(inspected.pageCount),
  };

  await savePrintUserDocuments(
    session.id,
    session.documents.map((entry) => (entry.id === docId ? ready : entry)),
  );
  return ready;
}

export async function deleteGuestDocument(session: PrintUserSession, docId: string) {
  const document = requireDocument(session, docId);
  try {
    await deleteObject(document.storageKey);
  } catch {
    // The guest cart should still drop the file if object storage already removed it.
  }
  await savePrintUserDocuments(
    session.id,
    session.documents.filter((entry) => entry.id !== docId),
  );
}

export async function updateGuestDocumentConfiguration(
  session: PrintUserSession,
  docId: string,
  input: PrintUserPrintConfigurationInput,
) {
  const document = requireDocument(session, docId);
  if (document.status !== "READY" || !document.pageCount) {
    throw new AuthServiceError(409, "document is still uploading");
  }

  const config = await getShopConfigByShopId(session.shopId);
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

  const updated: GuestDocument = {
    ...document,
    config: {
      colorMode: input.colorMode,
      copies: input.copies,
      paperSize: input.paperSize,
      pageSelection: pageSelectionValue(input.pageSelection.mode, input.pageSelection.expression, []),
      billablePages: billed,
      orientation: input.orientation ?? document.config.orientation,
    },
  };

  await savePrintUserDocuments(
    session.id,
    session.documents.map((entry) => (entry.id === docId ? updated : entry)),
  );
  return updated;
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

export async function submitGuestOrder(session: PrintUserSession, input: PrintUserSubmitOrderRequestInput) {
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

  await setPrintUserActiveOrder(session.id, order.id);
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
  const order = await getGuestOrder(session, orderId);
  const allowed = canMockConfirmPayment(order);
  if (!allowed.ok && allowed.reason !== "ORDER_NOT_ONLINE") {
    throw new AuthServiceError(409, allowed.reason);
  }
  if (!allowed.ok) {
    throw new AuthServiceError(409, allowed.reason);
  }

  const result = await confirmOnlinePayment(session.shopId, orderId, {
    paymentReference: `mock-${orderId}`,
    idempotencyKey,
  });

  if (result.autoAccepted) {
    const config = await getShopConfigByShopId(session.shopId);
    if (config.orderAutomation.autoDispatchAcceptedOrders) {
      await queueIncomingOrder({ id: "payment-provider", shopId: session.shopId } as never, orderId);
    }
  }

  return result.order;
}
