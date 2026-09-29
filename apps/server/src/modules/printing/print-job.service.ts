import { createHash, randomUUID } from "node:crypto";

import { FieldValue, getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import type {
  ClaimAgentPrintJobsRequestInput,
  ClaimPrintJobRequestInput,
  DispatchPrintJobRequestInput,
  PrinterOffered,
  PrinterTelemetryRequestInput,
  RetryPrintJobRequestInput,
  RoutePrintJobRequestInput,
  SyncPrintersRequestInput,
  UpdatePrinterConfigRequestInput,
  UpdatePrintJobRequestInput,
  UpdatePrinterPresetRequestInput,
} from "@ctrlp/schemas";
import {
  assertOfferWithinHardware,
  defaultPrinterOffered,
  shopPrinterCapabilityList,
} from "@ctrlp/schemas";
import type { AuthSessionUser } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { getShopOrder } from "@/src/modules/orders/order.service";
import { parsePageSelection } from "@/src/modules/printing/page-selection";

type PrintJobStatus = "QUEUED" | "DISPATCHING" | "PRINTING" | "COMPLETED" | "FAILED" | "CANCELLED";

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
  pageSelection: string;
  inputTray: string;
};

const REQUIRED_KEYS = ["colorMode", "copies", "paperSize", "pageSelection", "inputTray"] as const;

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
}

function readPreset(value: unknown, fallback: PrintSettings) {
  const settings = asSettings(value, fallback);
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const orientation = record.orientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT";
  const quality = ["DRAFT_300DPI", "STANDARD_600DPI", "HIGH_1200DPI"].includes(String(record.printQualityDpi))
    ? String(record.printQualityDpi)
    : "STANDARD_600DPI";
  return { ...settings, orientation, printQualityDpi: quality, pageSelection: settings.pageSelection || "all" };
}

function asSettings(value: unknown, fallback: PrintSettings): PrintSettings {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const colorMode = record.colorMode === "COLOR" || record.colorMode === "BW" ? record.colorMode : fallback.colorMode;
  const copies =
    typeof record.copies === "number" && Number.isInteger(record.copies) ? record.copies : fallback.copies;
  const paperSize = record.paperSize === "A3" || record.paperSize === "A4" ? record.paperSize : fallback.paperSize;
  const pageSelection = typeof record.pageSelection === "string" ? record.pageSelection : fallback.pageSelection;
  const inputTray = typeof record.inputTray === "string" ? record.inputTray : fallback.inputTray;
  return { colorMode, copies, paperSize, pageSelection, inputTray };
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

function toPrintJobDto(snapshot: { id: string; data: () => Record<string, unknown> | undefined }): PrintJobDto {
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

function assertJobTransition(current: PrintJobStatus, next: PrintJobStatus) {
  const transitions: Record<PrintJobStatus, PrintJobStatus[]> = {
    QUEUED: ["DISPATCHING", "CANCELLED"],
    DISPATCHING: ["PRINTING", "FAILED", "CANCELLED"],
    PRINTING: ["COMPLETED", "FAILED", "CANCELLED"],
    COMPLETED: [],
    FAILED: ["QUEUED", "CANCELLED"],
    CANCELLED: [],
  };

  if (current !== next && !transitions[current].includes(next)) {
    throw new AuthServiceError(409, "PRINT_JOB_STATUS_CONFLICT");
  }
}

export async function syncShopPrinters(user: AuthSessionUser, input: SyncPrintersRequestInput) {
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

export async function listShopPrinters(user: AuthSessionUser) {
  const snapshot = await getFirebaseFirestore().collection(`shops/${user.shopId}/printers`).get();
  return {
    printers: snapshot.docs.map((document) =>
      serializePrinterDoc(document.id, document.data() as Record<string, unknown>),
    ),
  };
}

export async function updatePrinterConfig(
  user: AuthSessionUser,
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
  user: AuthSessionUser,
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

export async function dispatchPrintJob(user: AuthSessionUser, orderId: string, input: DispatchPrintJobRequestInput) {
  if (input.overrides.duplex === true) {
    throw new AuthServiceError(400, "duplex printing is not available");
  }

  const order = await getShopOrder(user, orderId);
  const document = order.documents.find((entry) => {
    const record = entry as { id?: string; docId?: string };
    return record.docId === input.documentId || record.id === input.documentId;
  }) as { pageCount?: number; storageKey?: string; config?: Record<string, unknown> } | undefined;

  if (!document) {
    throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
  }
  if (order.status !== "SHOP_ACCEPTED") {
    throw new AuthServiceError(409, "ORDER_NOT_ACCEPTED");
  }
  if (!document.storageKey) {
    throw new AuthServiceError(409, "DOCUMENT_NOT_READY");
  }

  const db = getFirebaseFirestore();
  const printerRef = db.doc(`shops/${user.shopId}/printers/${input.printerId}`);
  const idempotencyRef = db.doc(`shops/${user.shopId}/idempotencyKeys/${input.idempotencyKey}`);
  let jobId: string = randomUUID();
  let colorWarning = false;

  await db.runTransaction(async (transaction) => {
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
  });

  const saved = await db.doc(`shops/${user.shopId}/orders/${orderId}/printJobs/${jobId}`).get();
  return {
    jobId,
    colorWarning,
    requestedOverrides: saved.get("requestedOverrides"),
    resolvedSettings: saved.get("resolvedSettings"),
    status: "QUEUED",
  };
}

export async function listOrderPrintJobs(user: AuthSessionUser, orderId: string) {
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

export async function listAgentPrintJobs(user: AuthSessionUser, input: ClaimAgentPrintJobsRequestInput) {
  const db = getFirebaseFirestore();
  const jobs = await listQueuedJobsByCollectionGroup(user.shopId, input).catch(() =>
    listQueuedJobsFromActiveOrders(user.shopId, input),
  );
  return {
    jobs: jobs.sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? "")),
  };
}

async function listQueuedJobsByCollectionGroup(shopId: string, input: ClaimAgentPrintJobsRequestInput) {
  const snapshot = await getFirebaseFirestore()
    .collectionGroup("printJobs")
    .where("shopId", "==", shopId)
    .where("agentId", "==", input.agentId)
    .where("status", "==", "QUEUED")
    .limit(input.limit)
    .get();
  return snapshot.docs.map((document) => toPrintJobDto(document));
}

async function listQueuedJobsFromActiveOrders(shopId: string, input: ClaimAgentPrintJobsRequestInput) {
  const orders = await getFirebaseFirestore()
    .collection(`shops/${shopId}/orders`)
    .where("status", "in", ["SHOP_ACCEPTED", "PRINTING"])
    .limit(40)
    .get();
  const jobs: PrintJobDto[] = [];
  for (const order of orders.docs) {
    const snapshot = await order.ref.collection("printJobs").get();
    for (const document of snapshot.docs) {
      if (document.get("agentId") === input.agentId && document.get("status") === "QUEUED") {
        jobs.push(toPrintJobDto(document));
      }
      if (jobs.length >= input.limit) {
        return jobs;
      }
    }
  }
  return jobs;
}

export async function claimPrintJob(
  user: AuthSessionUser,
  orderId: string,
  jobId: string,
  input: ClaimPrintJobRequestInput,
) {
  const db = getFirebaseFirestore();
  const orderRef = db.doc(`shops/${user.shopId}/orders/${orderId}`);
  const jobRef = orderRef.collection("printJobs").doc(jobId);
  const idempotencyRef = db.doc(`shops/${user.shopId}/idempotencyKeys/${input.idempotencyKey}`);
  const leaseId = randomUUID();

  await db.runTransaction(async (transaction) => {
    const [keySnap, orderSnap, jobSnap] = await Promise.all([
      transaction.get(idempotencyRef),
      transaction.get(orderRef),
      transaction.get(jobRef),
    ]);
    if (keySnap.exists) {
      if (keySnap.get("orderId") === orderId && keySnap.get("jobId") === jobId) {
        return;
      }
      throw new AuthServiceError(409, "IDEMPOTENCY_KEY_REUSED");
    }
    if (!orderSnap.exists) {
      throw new AuthServiceError(404, "ORDER_NOT_FOUND");
    }
    if (!jobSnap.exists) {
      throw new AuthServiceError(404, "PRINT_JOB_NOT_FOUND");
    }
    if (jobSnap.get("agentId") !== input.agentId) {
      throw new AuthServiceError(403, "PRINT_JOB_AGENT_MISMATCH");
    }
    if (jobSnap.get("status") !== "QUEUED") {
      throw new AuthServiceError(
        409,
        jobSnap.get("leaseId") ? "another device claimed this job" : "PRINT_JOB_STATUS_CONFLICT",
      );
    }

    const now = FieldValue.serverTimestamp();
    transaction.update(jobRef, {
      status: "DISPATCHING",
      leaseId,
      claimedAt: now,
      updatedAt: now,
    });
    transaction.set(idempotencyRef, {
      orderId,
      jobId,
      action: "claim-print-job",
      requestPath: `orders/${orderId}/printJobs/${jobId}/claim`,
      createdAt: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    if (orderSnap.get("status") === "SHOP_ACCEPTED") {
      transaction.update(orderRef, { status: "PRINTING", updatedAt: now });
    }
  });

  return toPrintJobDto(await jobRef.get());
}

export async function updatePrintJob(
  user: AuthSessionUser,
  orderId: string,
  jobId: string,
  input: UpdatePrintJobRequestInput,
) {
  const db = getFirebaseFirestore();
  const orderRef = db.doc(`shops/${user.shopId}/orders/${orderId}`);
  const jobRef = orderRef.collection("printJobs").doc(jobId);
  const idempotencyRef = db.doc(`shops/${user.shopId}/idempotencyKeys/${input.idempotencyKey}`);

  await db.runTransaction(async (transaction) => {
    const [keySnap, orderSnap, jobSnap, siblingJobs] = await Promise.all([
      transaction.get(idempotencyRef),
      transaction.get(orderRef),
      transaction.get(jobRef),
      transaction.get(orderRef.collection("printJobs")),
    ]);
    if (keySnap.exists) {
      if (keySnap.get("orderId") === orderId && keySnap.get("jobId") === jobId) {
        return;
      }
      throw new AuthServiceError(409, "IDEMPOTENCY_KEY_REUSED");
    }
    if (!orderSnap.exists) {
      throw new AuthServiceError(404, "ORDER_NOT_FOUND");
    }
    if (!jobSnap.exists) {
      throw new AuthServiceError(404, "PRINT_JOB_NOT_FOUND");
    }

    const current = String(jobSnap.get("status") ?? "QUEUED") as PrintJobStatus;
    assertJobTransition(current, input.status);
    const pagesTotal = Number(jobSnap.get("pagesTotal") ?? 1);
    if (input.pagesPrinted !== undefined && input.pagesPrinted > pagesTotal) {
      throw new AuthServiceError(400, "PRINT_JOB_PAGES_EXCEED_TOTAL");
    }

    const now = FieldValue.serverTimestamp();
    const update: Record<string, unknown> = {
      status: input.status,
      updatedAt: now,
      ...(input.pagesPrinted !== undefined ? { pagesPrinted: input.pagesPrinted } : {}),
      ...(input.spoolerJobId !== undefined ? { spoolerJobId: input.spoolerJobId } : {}),
      ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
      ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
      ...(input.status === "PRINTING" ? { startedAt: now } : {}),
      ...(input.status === "COMPLETED" || input.status === "FAILED" || input.status === "CANCELLED"
        ? { completedAt: now }
        : {}),
    };
    transaction.update(jobRef, update);

    const orderStatus = String(orderSnap.get("status") ?? "");
    if ((input.status === "DISPATCHING" || input.status === "PRINTING") && orderStatus === "SHOP_ACCEPTED") {
      transaction.update(orderRef, { status: "PRINTING", updatedAt: now });
    }

    if (input.status === "COMPLETED") {
      const expectedDocumentIds = new Set(
        Array.isArray(orderSnap.get("documents"))
          ? (orderSnap.get("documents") as Array<Record<string, unknown>>)
              .map((document) => document.docId ?? document.id)
              .filter((id): id is string => typeof id === "string" && id.length > 0)
          : [],
      );
      const completedDocumentIds = new Set(
        siblingJobs.docs
          .filter((document) => document.id === jobId || document.get("status") === "COMPLETED")
          .map((document) => document.get("documentId"))
          .filter((id): id is string => typeof id === "string"),
      );
      const allCompleted = expectedDocumentIds.size > 0 &&
        [...expectedDocumentIds].every((documentId) => completedDocumentIds.has(documentId));
      if (allCompleted && orderStatus === "PRINTING") {
        transaction.update(orderRef, {
          status: "READY",
          "lifecycle.readyAt": now,
          updatedAt: now,
        });
      }
    }

    transaction.set(idempotencyRef, {
      orderId,
      jobId,
      action: "update-print-job",
      requestPath: `orders/${orderId}/printJobs/${jobId}`,
      createdAt: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });

  const saved = await jobRef.get();
  return toPrintJobDto(saved);
}

export async function retryPrintJob(
  user: AuthSessionUser,
  orderId: string,
  jobId: string,
  input: RetryPrintJobRequestInput,
) {
  const db = getFirebaseFirestore();
  const orderRef = db.doc(`shops/${user.shopId}/orders/${orderId}`);
  const jobRef = orderRef.collection("printJobs").doc(jobId);
  const idempotencyRef = db.doc(`shops/${user.shopId}/idempotencyKeys/${input.idempotencyKey}`);

  await db.runTransaction(async (transaction) => {
    const [keySnap, jobSnap] = await Promise.all([transaction.get(idempotencyRef), transaction.get(jobRef)]);
    if (keySnap.exists) {
      if (keySnap.get("orderId") === orderId && keySnap.get("jobId") === jobId) {
        return;
      }
      throw new AuthServiceError(409, "IDEMPOTENCY_KEY_REUSED");
    }
    if (!jobSnap.exists) {
      throw new AuthServiceError(404, "PRINT_JOB_NOT_FOUND");
    }
    if (jobSnap.get("status") !== "FAILED") {
      throw new AuthServiceError(409, "PRINT_JOB_STATUS_CONFLICT");
    }

    const now = FieldValue.serverTimestamp();
    transaction.update(jobRef, {
      status: "QUEUED",
      ...(input.printerId ? { printerId: input.printerId } : {}),
      pagesPrinted: 0,
      spoolerJobId: null,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      retryCount: Number(jobSnap.get("retryCount") ?? 0) + 1,
      updatedAt: now,
    });
    transaction.set(idempotencyRef, {
      orderId,
      jobId,
      action: "retry-print-job",
      requestPath: `orders/${orderId}/printJobs/${jobId}/retry`,
      createdAt: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });

  return toPrintJobDto(await jobRef.get());
}

export async function queueIncomingOrder(user: AuthSessionUser, orderId: string) {
  const order = await getShopOrder(user, orderId);
  for (const document of order.documents) {
    const record = document as {
      id?: string;
      docId?: string;
      colorMode?: "BW" | "COLOR";
      copies?: number;
      paperSize?: "A4" | "A3";
      pageCount?: number;
      config?: { colorMode?: "BW" | "COLOR"; copies?: number; paperSize?: "A4" | "A3"; pageSelection?: string };
    };
    const documentId = record.docId || record.id;
    if (!documentId) {
      continue;
    }

    const colorMode = record.config?.colorMode ?? record.colorMode ?? "BW";
    const paperSize = record.config?.paperSize ?? record.paperSize ?? "A4";
    try {
      const route = await routePrintJob(user, { colorMode, paperSize });
      await dispatchPrintJob(user, orderId, {
        printerId: route.printerId,
        documentId,
        idempotencyKey: randomUUID(),
        overrides: {
          colorMode,
          copies: record.config?.copies ?? record.copies ?? 1,
          paperSize,
          pageSelection: record.config?.pageSelection ?? "all",
        },
      });
    } catch (error) {
      console.error("No printer assigned for document", documentId, error);
    }
  }
}

export async function writePrinterTelemetry(
  user: AuthSessionUser,
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

export async function routePrintJob(user: AuthSessionUser, input: RoutePrintJobRequestInput) {
  const snapshot = await getFirebaseFirestore().collection(`shops/${user.shopId}/printers`).get();
  const required = input.colorMode === "COLOR" ? [input.paperSize, "COLOR"] : [input.paperSize];
  const candidates = snapshot.docs
    .map((document) => ({ id: document.id, data: document.data() }))
    .filter((printer) => printer.data.enabled !== false)
    .filter((printer) => printer.data.status === "ONLINE" || printer.data.status === "PRINTING")
    .filter((printer) => {
      const capabilities = Array.isArray(printer.data.capabilities) ? printer.data.capabilities : [];
      return required.every((capability) => capabilities.includes(capability));
    })
    .sort((left, right) => {
      const defaultRank = Number(right.data.isDefault === true) - Number(left.data.isDefault === true);
      if (defaultRank !== 0) {
        return defaultRank;
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
