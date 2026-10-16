import { createHash, randomUUID } from "node:crypto";

import { getObjectSize, isMissingObjectError } from "@ctrlp/firebase";
import { FieldValue, getFirebaseFirestore, type DocumentReference } from "@ctrlp/firebase/firestore";
import type {
  CancelPrintJobRequestInput,
  DispatchPrintJobRequestInput,
  PrinterOffered,
  PrinterTelemetryRequestInput,
  RetryPrintJobRequestInput,
  RoutePrintJobRequestInput,
  SyncPrintersRequestInput,
  UpdatePrinterConfigRequestInput,
  UpdatePrinterPresetRequestInput,
} from "@ctrlp/schemas";
import {
  assertOfferWithinHardware,
  defaultPrinterOffered,
  shopPrinterCapabilityList,
} from "@ctrlp/schemas";
import type { ShopPrincipal } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { getShopOrder, type OrderDto } from "@/src/modules/orders/order.service";
import { decideCancel, decideRetry } from "@/src/modules/printing/job-model";
import { parsePageSelection } from "@/src/modules/printing/page-selection";
import { ringShop } from "@/src/modules/realtime/doorbell";
import { invalidateShopConfig } from "@/src/modules/shops/shop-config.service";

type PrintJobStatus = "QUEUED" | "DISPATCHING" | "PRINTING" | "COMPLETED" | "FAILED" | "CANCELLED";

const ACTIVE_JOB_STATUSES = new Set<string>(["QUEUED", "DISPATCHING", "PRINTING"]);

export type PrintJobDto = {
  id: string;
  orderId: string;
  documentId: string;
  printerId: string;
  printerName: string;
  printerSystemName: string;
  agentId: string | null;
  status: PrintJobStatus;
  pagesTotal: number;
  pagesPrinted: number;
  spoolerJobId: number | null;
  retryCount: number;
  requestedOverrides: Record<string, unknown>;
  resolvedSettings: Record<string, unknown>;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  leaseId: string | null;
  claimedAt: string | null;
};

type PrintSettings = {
  colorMode: "BW" | "COLOR";
  copies: number;
  paperSize: "A4" | "A3";
  /** The agent's executor reads this from `resolvedSettings` (WindowsDocumentPrintExecutor). */
  orientation: "PORTRAIT" | "LANDSCAPE";
  pageSelection: string;
  inputTray: string;
};

const REQUIRED_KEYS = ["colorMode", "copies", "paperSize", "orientation", "pageSelection", "inputTray"] as const;

export function printerIdFor(name: string) {
  return createHash("sha256").update(name).digest("hex").slice(0, 32);
}

function hardwarePaper(printer: {
  supportsA4?: boolean;
  supportsA3?: boolean;
  supportedPaperSizes?: Array<"A4" | "A3">;
}) {
  const sizes = new Set(printer.supportedPaperSizes ?? []);
  const supportsA4 = printer.supportsA4 === true || sizes.has("A4") || (printer.supportsA4 !== false && sizes.size === 0);
  const supportsA3 = printer.supportsA3 === true || sizes.has("A3");
  return {
    supportsA4,
    supportsA3,
    supportedPaperSizes: [...(supportsA4 ? (["A4"] as const) : []), ...(supportsA3 ? (["A3"] as const) : [])],
  };
}

function seedDefaultPrintSettings(printer: SyncPrintersRequestInput["printers"][number]) {
  const paper = hardwarePaper(printer);
  return {
    copies: 1,
    orientation: "PORTRAIT" as const,
    paperSize: paper.supportsA4 ? "A4" : paper.supportsA3 ? "A3" : "A4",
    inputTray: "AUTO_SELECT",
    colorMode: printer.isColorCapable ? "COLOR" : "MONOCHROME",
    printQualityDpi: "STANDARD_600DPI" as const,
  };
}

function defaultSettings(isColorCapable: boolean): PrintSettings {
  return {
    colorMode: isColorCapable ? "COLOR" : "BW",
    copies: 1,
    paperSize: "A4",
    orientation: "PORTRAIT",
    pageSelection: "all",
    inputTray: "AUTO_SELECT",
  };
}

function offeredFromDoc(value: unknown, hardware: { isColorCapable: boolean; supportsA3: boolean }): PrinterOffered {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    bw: record.bw !== false,
    color: record.color === true && hardware.isColorCapable,
    a4: record.a4 !== false,
    a3: record.a3 === true && hardware.supportsA3,
  };
}

function serializePrinterDoc(id: string, data: Record<string, unknown>) {
  const sizes = Array.isArray(data.supportedPaperSizes)
    ? (data.supportedPaperSizes.filter((size) => size === "A4" || size === "A3") as Array<"A4" | "A3">)
    : [];
  const paper = hardwarePaper({
    supportsA4: sizes.includes("A4") || sizes.length === 0,
    supportsA3: sizes.includes("A3"),
    supportedPaperSizes: sizes,
  });
  const hardware = {
    isColorCapable: data.isColorCapable === true,
    supportsA3: paper.supportsA3,
  };
  const offered = offeredFromDoc(data.offered, hardware);
  const enabled = data.enabled !== false;
  return {
    id,
    shopId: String(data.shopId ?? ""),
    agentId: typeof data.agentId === "string" ? data.agentId : null,
    name: String(data.name ?? ""),
    systemName: String(data.systemName ?? data.name ?? ""),
    driverName: String(data.driverName ?? ""),
    portName: String(data.portName ?? ""),
    status: String(data.status ?? "ONLINE"),
    statusReason: typeof data.statusReason === "string" ? data.statusReason : null,
    isDefault: data.isDefault === true,
    enabled,
    offered,
    isColorCapable: hardware.isColorCapable,
    isDuplexCapable: data.isDuplexCapable === true,
    supportedPaperSizes: paper.supportedPaperSizes,
    options: data.options && typeof data.options === "object" ? data.options : null,
    capabilities: Array.isArray(data.capabilities)
      ? data.capabilities
      : shopPrinterCapabilityList({
          enabled,
          isColorCapable: hardware.isColorCapable,
          supportsA4: paper.supportsA4,
          supportsA3: paper.supportsA3,
          offered,
        }),
    activeJobsCount: Number(data.activeJobsCount ?? data.activeSpoolJobs ?? 0),
    maximumCopies: Number(data.maximumCopies ?? 1),
    defaultPrintSettings:
      data.defaultPrintSettings && typeof data.defaultPrintSettings === "object"
        ? data.defaultPrintSettings
        : null,
  };
}

async function refreshShopOfferedCapabilities(shopId: string) {
  const db = getFirebaseFirestore();
  const snapshot = await db.collection(`shops/${shopId}/printers`).get();
  let colorPrinting = false;
  let a3Printing = false;
  for (const document of snapshot.docs) {
    const data = document.data();
    if (data.enabled === false) {
      continue;
    }
    const offered = data.offered && typeof data.offered === "object" ? (data.offered as Record<string, unknown>) : {};
    if (offered.color === true) {
      colorPrinting = true;
    }
    if (offered.a3 === true) {
      a3Printing = true;
    }
  }

  await db.doc(`shops/${shopId}`).set(
    {
      capabilities: {
        colorPrinting,
        a3Printing,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  invalidateShopConfig(shopId);
}

function asSettings(value: unknown, fallback: PrintSettings): PrintSettings {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const colorMode = record.colorMode === "COLOR" || record.colorMode === "BW" ? record.colorMode : fallback.colorMode;
  const copies =
    typeof record.copies === "number" && Number.isInteger(record.copies) ? record.copies : fallback.copies;
  const paperSize = record.paperSize === "A3" || record.paperSize === "A4" ? record.paperSize : fallback.paperSize;
  const orientation =
    record.orientation === "LANDSCAPE" || record.orientation === "PORTRAIT" ? record.orientation : fallback.orientation;
  const pageSelection = typeof record.pageSelection === "string" ? record.pageSelection : fallback.pageSelection;
  const inputTray = typeof record.inputTray === "string" ? record.inputTray : fallback.inputTray;
  return { colorMode, copies, paperSize, orientation, pageSelection, inputTray };
}

function timestampToIso(value: unknown) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function toPrintJobDto(snapshot: { id: string; data: () => Record<string, unknown> | undefined }): PrintJobDto {
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    orderId: String(data.orderId ?? ""),
    documentId: String(data.documentId ?? ""),
    printerId: String(data.printerId ?? ""),
    printerName: String(data.printerName ?? ""),
    printerSystemName: String(data.printerSystemName ?? data.printerName ?? ""),
    agentId: typeof data.agentId === "string" ? data.agentId : null,
    status: (typeof data.status === "string" ? data.status : "QUEUED") as PrintJobStatus,
    pagesTotal: Number(data.pagesTotal ?? 1),
    pagesPrinted: Number(data.pagesPrinted ?? 0),
    spoolerJobId: typeof data.spoolerJobId === "number" ? data.spoolerJobId : null,
    retryCount: Number(data.retryCount ?? 0),
    requestedOverrides: asRecord(data.requestedOverrides),
    resolvedSettings: asRecord(data.resolvedSettings),
    errorCode: typeof data.errorCode === "string" ? data.errorCode : null,
    errorMessage: typeof data.errorMessage === "string" ? data.errorMessage : null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    startedAt: timestampToIso(data.startedAt),
    completedAt: timestampToIso(data.completedAt),
    leaseId: typeof data.leaseId === "string" ? data.leaseId : null,
    claimedAt: timestampToIso(data.claimedAt),
  };
}

export async function syncShopPrinters(user: ShopPrincipal, input: SyncPrintersRequestInput) {
  const db = getFirebaseFirestore();
  const collection = db.collection(`shops/${user.shopId}/printers`);
  const existingDocs = await collection.get();
  let shopHasDefault = existingDocs.docs.some((document) => document.get("isDefault") === true);
  const printers = [];

  for (const printer of input.printers) {
    const systemName = printer.systemName ?? printer.name;
    const id = printerIdFor(systemName);
    const reference = db.doc(`shops/${user.shopId}/printers/${id}`);
    const existing = await reference.get();
    const paper = hardwarePaper(printer);
    const hardware = { isColorCapable: printer.isColorCapable, supportsA3: paper.supportsA3 };
    const offered = existing.exists
      ? offeredFromDoc(existing.get("offered"), hardware)
      : defaultPrinterOffered(hardware);
    const enabled = existing.exists ? existing.get("enabled") !== false : true;
    const isNew = !existing.exists;
    const isDefault = isNew && !shopHasDefault && printer.isDefault;
    if (isDefault) {
      shopHasDefault = true;
    }
    const now = FieldValue.serverTimestamp();
    const jobs = printer.activeJobsCount ?? printer.activeSpoolJobs ?? 0;

    await reference.set(
      {
        id,
        shopId: user.shopId,
        agentId: input.agentId,
        name: printer.name,
        systemName,
        driverName: printer.driverName ?? "",
        portName: printer.portName ?? "",
        isColorCapable: printer.isColorCapable,
        isDuplexCapable: printer.isDuplexCapable ?? false,
        supportedPaperSizes: paper.supportedPaperSizes,
        options: printer.options ?? {},
        capabilities: shopPrinterCapabilityList({
          enabled,
          isColorCapable: printer.isColorCapable,
          supportsA4: paper.supportsA4,
          supportsA3: paper.supportsA3,
          offered,
        }),
        maximumCopies: printer.maximumCopies,
        status: printer.status ?? "ONLINE",
        statusReason: printer.statusReason ?? null,
        activeJobsCount: jobs,
        activeSpoolJobs: jobs,
        lastSeenAt: now,
        duplex: false,
        ...(isNew
          ? {
              defaultPrintSettings: seedDefaultPrintSettings(printer),
              enabled: true,
              offered,
              isDefault,
              createdAt: now,
            }
          : {}),
        updatedAt: now,
      },
      { merge: true },
    );

    const saved = await reference.get();
    printers.push(serializePrinterDoc(id, (saved.data() ?? {}) as Record<string, unknown>));
  }

  await refreshShopOfferedCapabilities(user.shopId);
  return { printers };
}

export async function listShopPrinters(user: ShopPrincipal) {
  const snapshot = await getFirebaseFirestore().collection(`shops/${user.shopId}/printers`).get();
  return {
    printers: snapshot.docs.map((document) =>
      serializePrinterDoc(document.id, document.data() as Record<string, unknown>),
    ),
  };
}

export async function updatePrinterConfig(
  user: ShopPrincipal,
  printerId: string,
  input: UpdatePrinterConfigRequestInput,
) {
  const db = getFirebaseFirestore();
  const reference = db.doc(`shops/${user.shopId}/printers/${printerId}`);
  const existing = await reference.get();
  if (!existing.exists) {
    throw new AuthServiceError(404, "printer is not registered");
  }

  const sizes = Array.isArray(existing.get("supportedPaperSizes"))
    ? (existing.get("supportedPaperSizes") as unknown[]).filter((size) => size === "A4" || size === "A3")
    : [];
  const hardware = {
    isColorCapable: existing.get("isColorCapable") === true,
    supportsA3: sizes.includes("A3"),
    supportsA4: sizes.includes("A4") || sizes.length === 0,
  };

  if (input.offered) {
    try {
      assertOfferWithinHardware(input.offered, hardware);
    } catch (error) {
      throw new AuthServiceError(400, error instanceof Error ? error.message : "invalid offered capabilities");
    }
  }

  const currentOffered = offeredFromDoc(existing.get("offered"), hardware);
  const nextOffered: PrinterOffered = {
    bw: true,
    a4: true,
    color: input.offered?.color ?? currentOffered.color,
    a3: input.offered?.a3 ?? currentOffered.a3,
  };
  const enabled = input.enabled ?? existing.get("enabled") !== false;
  let isDefault = input.isDefault ?? existing.get("isDefault") === true;

  if (input.isDefault === true && !enabled) {
    throw new AuthServiceError(400, "disabled printers cannot be the shop default");
  }
  if (!enabled) {
    isDefault = false;
  }

  const now = FieldValue.serverTimestamp();
  const payload = {
    enabled,
    offered: nextOffered,
    isDefault,
    capabilities: shopPrinterCapabilityList({
      enabled,
      isColorCapable: hardware.isColorCapable,
      supportsA4: hardware.supportsA4,
      supportsA3: hardware.supportsA3,
      offered: nextOffered,
    }),
    updatedAt: now,
  };

  if (isDefault) {
    const others = await db.collection(`shops/${user.shopId}/printers`).get();
    const batch = db.batch();
    for (const document of others.docs) {
      if (document.id !== printerId && document.get("isDefault") === true) {
        batch.set(document.ref, { isDefault: false, updatedAt: now }, { merge: true });
      }
    }
    batch.set(reference, payload, { merge: true });
    await batch.commit();
  } else {
    await reference.set(payload, { merge: true });
  }

  await refreshShopOfferedCapabilities(user.shopId);
  const saved = await reference.get();
  return serializePrinterDoc(printerId, (saved.data() ?? {}) as Record<string, unknown>);
}

export async function updatePrinterPreset(
  user: ShopPrincipal,
  printerId: string,
  settings: UpdatePrinterPresetRequestInput,
) {
  const reference = getFirebaseFirestore().doc(`shops/${user.shopId}/printers/${printerId}`);
  const existing = await reference.get();
  if (!existing.exists) {
    throw new AuthServiceError(404, "printer is not registered");
  }

  const db = getFirebaseFirestore();
  const now = FieldValue.serverTimestamp();
  const preset = {
    colorMode: settings.colorMode,
    copies: settings.copies,
    paperSize: settings.paperSize,
    orientation: settings.orientation,
    inputTray: settings.inputTray,
    printQualityDpi: settings.printQualityDpi,
    pageSelection: "all",
    duplex: false,
  };

  if (settings.isDefault) {
    const others = await db.collection(`shops/${user.shopId}/printers`).get();
    const batch = db.batch();
    for (const document of others.docs) {
      if (document.id !== printerId && document.get("isDefault") === true) {
        batch.set(document.ref, { isDefault: false, updatedAt: now }, { merge: true });
      }
    }
    batch.set(reference, { isDefault: true, defaultPrintSettings: preset, updatedAt: now }, { merge: true });
    await batch.commit();
  } else {
    await reference.set({ isDefault: false, defaultPrintSettings: preset, updatedAt: now }, { merge: true });
  }

  return { id: printerId, isDefault: settings.isDefault, defaultPrintSettings: preset };
}

export async function dispatchPrintJob(
  user: ShopPrincipal,
  orderId: string,
  input: DispatchPrintJobRequestInput,
  options: { quietAgentId?: string } = {},
) {
  if (input.overrides.duplex === true) {
    throw new AuthServiceError(400, "duplex printing is not available");
  }

  const order = await getShopOrder(user, orderId);
  const document = order.documents.find((entry) => {
    const record = entry as { id?: string; docId?: string };
    return record.docId === input.documentId || record.id === input.documentId;
  }) as { pageCount?: number; storageKey?: string; shreddedAt?: string | null; config?: Record<string, unknown> } | undefined;

  if (!document) {
    throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
  }
  // The first claimed job moves the order to PRINTING; sibling documents must still be dispatchable.
  if (order.status !== "SHOP_ACCEPTED" && order.status !== "PRINTING") {
    throw new AuthServiceError(409, "ORDER_NOT_ACCEPTED");
  }
  if (!document.storageKey) {
    throw new AuthServiceError(409, "DOCUMENT_NOT_READY");
  }
  if (document.shreddedAt) {
    throw new AuthServiceError(409, "DOCUMENT_SHREDDED");
  }

  const db = getFirebaseFirestore();
  const printerRef = db.doc(`shops/${user.shopId}/printers/${input.printerId}`);
  const idempotencyRef = db.doc(`shops/${user.shopId}/idempotencyKeys/${input.idempotencyKey}`);
  let jobId: string = randomUUID();
  let colorWarning = false;
  let created = false;
  let jobAgentId = "";

  await db.runTransaction(async (transaction) => {
    created = false;
    const keySnap = await transaction.get(idempotencyRef);
    if (keySnap.exists) {
      const storedOrderId = keySnap.get("orderId");
      const storedAction = keySnap.get("action");
      const storedJobId = keySnap.get("jobId");
      if (storedOrderId === orderId && storedAction === "dispatch" && typeof storedJobId === "string") {
        jobId = storedJobId;
        return;
      }
      throw new AuthServiceError(409, "IDEMPOTENCY_KEY_REUSED");
    }

    // One active job per document, so a document is never printed twice by accident.
    const documentJobs = await transaction.get(
      db.collection(`shops/${user.shopId}/orders/${orderId}/printJobs`).where("documentId", "==", input.documentId),
    );
    if (documentJobs.docs.some((job) => ACTIVE_JOB_STATUSES.has(String(job.get("status"))))) {
      throw new AuthServiceError(409, "JOB_ACTIVE");
    }

    const printerSnap = await transaction.get(printerRef);
    if (!printerSnap.exists) {
      throw new AuthServiceError(404, "printer is not registered");
    }
    if (printerSnap.get("enabled") === false) {
      throw new AuthServiceError(409, "PRINTER_DISABLED");
    }
    if (printerSnap.get("status") !== "ONLINE" && printerSnap.get("status") !== "PRINTING") {
      throw new AuthServiceError(409, "PRINTER_UNAVAILABLE");
    }
    const agentId = printerSnap.get("agentId");
    if (typeof agentId !== "string" || !agentId) {
      throw new AuthServiceError(409, "PRINTER_AGENT_UNAVAILABLE");
    }

    const fallback = defaultSettings(printerSnap.get("isColorCapable") === true);
    const defaults = asSettings(printerSnap.get("defaultPrintSettings"), fallback);
    const requestedOverrides = Object.fromEntries(
      Object.entries(input.overrides).filter(([, value]) => value !== undefined && value !== null),
    );
    delete requestedOverrides.duplex;
    const resolved = asSettings({ ...defaults, ...requestedOverrides }, defaults);
    const maximumCopies = Number(printerSnap.get("maximumCopies") ?? 1);

    if (resolved.copies > maximumCopies) {
      throw new AuthServiceError(400, `this printer only prints ${maximumCopies} ${maximumCopies === 1 ? "copy" : "copies"}`);
    }

    for (const key of REQUIRED_KEYS) {
      if (resolved[key] === undefined || resolved[key] === null || resolved[key] === "") {
        throw new AuthServiceError(400, `resolved settings missing ${key}`);
      }
    }

    try {
      parsePageSelection(resolved.pageSelection, document.pageCount ?? 1);
    } catch (error) {
      throw new AuthServiceError(400, error instanceof Error ? error.message : "invalid page selection");
    }

    const offered = asRecord(printerSnap.get("offered"));
    const capabilities = Array.isArray(printerSnap.get("capabilities"))
      ? printerSnap.get("capabilities") as unknown[]
      : [];
    if (!capabilities.includes(resolved.paperSize) || (resolved.colorMode === "COLOR" &&
      (printerSnap.get("isColorCapable") !== true || offered.color !== true || !capabilities.includes("COLOR")))) {
      throw new AuthServiceError(409, "PRINTER_INCOMPATIBLE");
    }
    colorWarning = false;
    const pages = parsePageSelection(resolved.pageSelection, document.pageCount ?? 1);
    const jobRef = db.doc(`shops/${user.shopId}/orders/${orderId}/printJobs/${jobId}`);

    transaction.set(jobRef, {
      id: jobId,
      orderId,
      shopId: user.shopId,
      documentId: input.documentId,
      printerId: input.printerId,
      printerName: printerSnap.get("name") ?? "",
      agentId,
      printerSystemName: String(printerSnap.get("systemName") ?? printerSnap.get("name") ?? ""),
      requestedOverrides,
      resolvedSettings: {
        ...resolved,
        duplex: false,
        billablePageCount: pages.length,
      },
      status: "QUEUED",
      pagesTotal: pages.length * resolved.copies,
      pagesPrinted: 0,
      spoolerJobId: null,
      retryCount: 0,
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      leaseId: null,
      claimedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(idempotencyRef, {
      orderId,
      action: "dispatch",
      jobId,
      requestPath: `orders/${orderId}/jobs`,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    jobAgentId = agentId;
    created = true;
  });

  if (created) {
    // A document the operator dispatched by hand after queueing failed is no longer an error.
    if (order.queueErrors.some((entry) => entry.documentId === input.documentId)) {
      await db.doc(`shops/${user.shopId}/orders/${orderId}`).update({
        queueErrors: order.queueErrors.filter((entry) => entry.documentId !== input.documentId),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await ringShop(user.shopId, {
      work: jobAgentId !== options.quietAgentId,
      event: "jobs_queued",
      orderId,
      orderNumber: order.orderNumber,
    });
  }

  const saved = await db.doc(`shops/${user.shopId}/orders/${orderId}/printJobs/${jobId}`).get();
  return {
    jobId,
    colorWarning,
    requestedOverrides: saved.get("requestedOverrides"),
    resolvedSettings: saved.get("resolvedSettings"),
    status: "QUEUED",
  };
}

export async function listOrderPrintJobs(user: ShopPrincipal, orderId: string) {
  await getShopOrder(user, orderId);
  const snapshot = await getFirebaseFirestore()
    .collection(`shops/${user.shopId}/orders/${orderId}/printJobs`)
    .get();
  return {
    jobs: snapshot.docs
      .map((document) => toPrintJobDto(document))
      .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? "")),
  };
}

type OrderDocumentFile = { id?: string; docId?: string; storageKey?: string; storageBackend?: string; shreddedAt?: string | null };

function findOrderDocument(documents: unknown, documentId: string) {
  if (!Array.isArray(documents) || !documentId) {
    return undefined;
  }
  return (documents as OrderDocumentFile[]).find((entry) => entry.docId === documentId || entry.id === documentId);
}

/**
 * 409 `DOCUMENT_MISSING` when the job's stored file is gone from the bucket, so a retry is refused
 * instead of queueing a job that can only fail again. Storage being unreachable is not proof the
 * file is gone; the retry goes ahead and the agent's download decides.
 */
async function assertJobFileInStorage(
  orderRef: DocumentReference,
  jobRef: DocumentReference,
) {
  const [jobSnap, orderSnap] = await Promise.all([jobRef.get(), orderRef.get()]);
  const document = jobSnap.exists ? findOrderDocument(orderSnap.get("documents"), String(jobSnap.get("documentId") ?? "")) : undefined;
  // Missing jobs, documents and shredded files are refused inside the transaction.
  if (!document?.storageKey || document.shreddedAt || document.storageBackend !== "s3") {
    return;
  }
  try {
    await getObjectSize(document.storageKey);
  } catch (error) {
    if (isMissingObjectError(error)) {
      throw new AuthServiceError(409, "DOCUMENT_MISSING");
    }
  }
}

function millis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return typeof value === "string" ? Date.parse(value) : 0;
}

/**
 * Puts a job back in the queue. Also the operator's way to rescue a job: allowed from FAILED, from
 * QUEUED (to re-route it), and from DISPATCHING once it has been stuck for 15 minutes. The lease is
 * cleared, so a late report from the old PC gets `lease_mismatch`.
 */
export async function retryPrintJob(
  user: ShopPrincipal,
  orderId: string,
  jobId: string,
  input: RetryPrintJobRequestInput,
) {
  const db = getFirebaseFirestore();
  const orderRef = db.doc(`shops/${user.shopId}/orders/${orderId}`);
  const jobRef = orderRef.collection("printJobs").doc(jobId);
  const printerRef = input.printerId ? db.doc(`shops/${user.shopId}/printers/${input.printerId}`) : null;
  let retried = false;
  let orderNumber = "";
  let jobAgentId = "";

  await assertJobFileInStorage(orderRef, jobRef);

  await db.runTransaction(async (transaction) => {
    retried = false;
    const [jobSnap, orderSnap, printerSnap] = await Promise.all([
      transaction.get(jobRef),
      transaction.get(orderRef),
      printerRef ? transaction.get(printerRef) : Promise.resolve(null),
    ]);
    if (!jobSnap.exists) {
      throw new AuthServiceError(404, "PRINT_JOB_NOT_FOUND");
    }

    const samePrinter = !input.printerId || input.printerId === jobSnap.get("printerId");
    const decision = decideRetry({
      status: String(jobSnap.get("status") ?? ""),
      claimedAtMs: millis(jobSnap.get("claimedAt")),
      samePrinter,
      nowMs: Date.now(),
    });
    if (decision.kind === "replay") {
      return;
    }
    if (decision.kind === "reject") {
      throw new AuthServiceError(409, decision.reason);
    }

    // A job is only worth queueing again if its order still prints and its file is still there.
    const orderStatus = orderSnap.exists ? String(orderSnap.get("status") ?? "") : "";
    if (orderStatus !== "SHOP_ACCEPTED" && orderStatus !== "PRINTING") {
      throw new AuthServiceError(409, "ORDER_NOT_ACCEPTED");
    }
    const document = findOrderDocument(orderSnap.get("documents"), String(jobSnap.get("documentId") ?? ""));
    if (!document) {
      throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
    }
    if (document.shreddedAt) {
      throw new AuthServiceError(409, "DOCUMENT_SHREDDED");
    }
    if (!document.storageKey) {
      throw new AuthServiceError(409, "DOCUMENT_NOT_READY");
    }

    const reroute: Record<string, unknown> = {};
    if (printerSnap && !samePrinter) {
      if (!printerSnap.exists) {
        throw new AuthServiceError(404, "printer is not registered");
      }
      if (printerSnap.get("enabled") === false) {
        throw new AuthServiceError(409, "PRINTER_DISABLED");
      }
      const agentId = printerSnap.get("agentId");
      if (typeof agentId !== "string" || !agentId) {
        throw new AuthServiceError(409, "PRINTER_AGENT_UNAVAILABLE");
      }
      Object.assign(reroute, {
        printerId: input.printerId,
        agentId,
        printerName: printerSnap.get("name") ?? "",
        printerSystemName: String(printerSnap.get("systemName") ?? printerSnap.get("name") ?? ""),
      });
    }

    const now = FieldValue.serverTimestamp();
    transaction.update(jobRef, {
      status: "QUEUED",
      ...reroute,
      leaseId: null,
      claimedAt: null,
      startedAt: null,
      pagesPrinted: 0,
      spoolerJobId: null,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      retryCount: Number(jobSnap.get("retryCount") ?? 0) + 1,
      updatedAt: now,
    });
    orderNumber = String(orderSnap.get("orderNumber") ?? "");
    jobAgentId = String(reroute.agentId ?? jobSnap.get("agentId") ?? "");
    retried = true;
  });

  if (retried) {
    await ringShop(user.shopId, { work: Boolean(jobAgentId), event: "jobs_queued", orderId, orderNumber });
  }

  return toPrintJobDto(await jobRef.get());
}

/**
 * Stops a job: one waiting, one that failed, or one a PC claimed and then went quiet (the rescue
 * rule). The lease is cleared, so the PC learns from its next `sync` (`revoked`) that the job is no
 * longer its to print, and a late report from it gets `lease_mismatch`. The document can be
 * dispatched again later; nothing else about the order changes.
 */
export async function cancelPrintJob(
  user: ShopPrincipal,
  orderId: string,
  jobId: string,
  input: CancelPrintJobRequestInput,
) {
  const db = getFirebaseFirestore();
  const jobRef = db.doc(`shops/${user.shopId}/orders/${orderId}/printJobs/${jobId}`);
  let cancelled = false;
  let heldByAgent = false;

  await db.runTransaction(async (transaction) => {
    cancelled = false;
    const jobSnap = await transaction.get(jobRef);
    if (!jobSnap.exists) {
      throw new AuthServiceError(404, "PRINT_JOB_NOT_FOUND");
    }
    const status = String(jobSnap.get("status") ?? "");
    const decision = decideCancel({ status, claimedAtMs: millis(jobSnap.get("claimedAt")), nowMs: Date.now() });
    if (decision.kind === "replay") {
      return;
    }
    if (decision.kind === "reject") {
      throw new AuthServiceError(409, decision.reason);
    }

    const now = FieldValue.serverTimestamp();
    transaction.update(jobRef, {
      status: "CANCELLED",
      leaseId: null,
      claimedAt: null,
      errorCode: "CANCELLED_BY_SHOP",
      errorMessage: input.reason ?? null,
      cancelledAt: now,
      cancelledByUserId: user.shopUserId,
      completedAt: now,
      updatedAt: now,
    });
    heldByAgent = status === "DISPATCHING" || status === "PRINTING";
    cancelled = true;
  });

  if (cancelled) {
    // A PC that holds the job hears about it on its next sync; `work` makes that sync happen now.
    await ringShop(user.shopId, { work: heldByAgent, event: "order_updated", orderId, orderNumber: "" });
  }
  return toPrintJobDto(await jobRef.get());
}

/**
 * Queues one job per document of an accepted order. Printers on `preferAgentId` (the PC that
 * accepted) are chosen first. Jobs routed to `quietAgentId` don't ring `work`: that agent is
 * already syncing and claims them in the same request.
 */
export async function queueIncomingOrder(
  user: ShopPrincipal,
  orderId: string,
  options: { preferAgentId?: string; quietAgentId?: string } = {},
) {
  const order = await getShopOrder(user, orderId);
  const failures: OrderDto["queueErrors"] = [];
  for (const document of order.documents) {
    const record = document as {
      id?: string;
      docId?: string;
      colorMode?: "BW" | "COLOR";
      copies?: number;
      paperSize?: "A4" | "A3";
      pageCount?: number;
      config?: {
        colorMode?: "BW" | "COLOR";
        copies?: number;
        paperSize?: "A4" | "A3";
        orientation?: "PORTRAIT" | "LANDSCAPE";
        pageSelection?: string;
      };
    };
    const documentId = record.docId || record.id;
    if (!documentId) {
      continue;
    }

    const colorMode = record.config?.colorMode ?? record.colorMode ?? "BW";
    const paperSize = record.config?.paperSize ?? record.paperSize ?? "A4";
    try {
      const route = await routePrintJob(user, { colorMode, paperSize }, { preferAgentId: options.preferAgentId });
      await dispatchPrintJob(user, orderId, {
        printerId: route.printerId,
        documentId,
        // One key per order and document: queueing the same order twice returns the existing job.
        idempotencyKey: `queue:${orderId}:${documentId}`,
        overrides: {
          colorMode,
          copies: record.config?.copies ?? record.copies ?? 1,
          paperSize,
          // Older orders carry no orientation; the printer's preset applies to those.
          orientation: record.config?.orientation,
          pageSelection: record.config?.pageSelection ?? "all",
        },
      }, { quietAgentId: options.quietAgentId });
    } catch (error) {
      console.error("Could not queue print job for document", documentId, error);
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        documentId,
        // Service errors carry a code (PRINTER_INCOMPATIBLE) or a sentence; keep both readable.
        code: /^[A-Z][A-Z_]+$/.test(message) ? message : "QUEUE_FAILED",
        message,
        at: new Date().toISOString(),
      });
    }
  }

  // The shop sees on the order which documents did not reach a printer, and why, instead of an
  // order that sits in PRINTING with a document that never prints. A later run clears them.
  if (failures.length > 0 || order.queueErrors.length > 0) {
    await getFirebaseFirestore().doc(`shops/${user.shopId}/orders/${orderId}`).update({
      queueErrors: failures,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (failures.length > 0) {
    await ringShop(user.shopId, { work: false, event: "order_updated", orderId, orderNumber: order.orderNumber });
  }
  return { failures };
}

export async function writePrinterTelemetry(
  user: ShopPrincipal,
  printerId: string,
  input: PrinterTelemetryRequestInput,
) {
  const db = getFirebaseFirestore();
  const printerRef = db.doc(`shops/${user.shopId}/printers/${printerId}`);
  const existing = await printerRef.get();
  if (!existing.exists) {
    throw new AuthServiceError(404, "printer is not registered");
  }

  const telemetryRef = printerRef.collection("telemetry").doc();
  const batch = db.batch();
  batch.update(printerRef, {
    status: input.newStatus,
    statusReason: input.errorDescription ?? null,
    activeSpoolJobs: input.activeSpoolJobs,
    activeJobsCount: input.activeSpoolJobs,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(telemetryRef, {
    shopId: user.shopId,
    printerId,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    errorCode: input.errorCode ?? null,
    errorDescription: input.errorDescription ?? null,
    activeSpoolJobs: input.activeSpoolJobs,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { printerId, status: input.newStatus, telemetryId: telemetryRef.id };
}

/**
 * Picks a capable, enabled, online printer: the caller's PC first (`preferAgentId`), then the shop
 * default, then the least busy.
 */
export async function routePrintJob(
  user: ShopPrincipal,
  input: RoutePrintJobRequestInput,
  options: { preferAgentId?: string } = {},
) {
  const snapshot = await getFirebaseFirestore().collection(`shops/${user.shopId}/printers`).get();
  const required = input.colorMode === "COLOR" ? [input.paperSize, "COLOR"] : [input.paperSize];
  const rank = (printer: { data: Record<string, unknown> }) => [
    Number(Boolean(options.preferAgentId) && printer.data.agentId === options.preferAgentId),
    Number(printer.data.isDefault === true),
  ];
  const candidates = snapshot.docs
    .map((document) => ({ id: document.id, data: document.data() }))
    .filter((printer) => printer.data.enabled !== false)
    .filter((printer) => printer.data.status === "ONLINE" || printer.data.status === "PRINTING")
    .filter((printer) => {
      const capabilities = Array.isArray(printer.data.capabilities) ? printer.data.capabilities : [];
      return required.every((capability) => capabilities.includes(capability));
    })
    .sort((left, right) => {
      const [leftAgent, leftDefault] = rank(left);
      const [rightAgent, rightDefault] = rank(right);
      if (leftAgent !== rightAgent) {
        return rightAgent - leftAgent;
      }
      if (leftDefault !== rightDefault) {
        return rightDefault - leftDefault;
      }
      return Number(left.data.activeSpoolJobs ?? 0) - Number(right.data.activeSpoolJobs ?? 0);
    });

  const match = candidates[0];
  if (!match) {
    throw new AuthServiceError(404, "no compatible online printer is available");
  }

  return {
    printerId: match.id,
    name: String(match.data.name ?? ""),
    activeSpoolJobs: Number(match.data.activeSpoolJobs ?? 0),
    status: String(match.data.status ?? "ONLINE"),
  };
}
