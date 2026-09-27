import { createHash, randomUUID } from "node:crypto";

import { FieldValue, getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import type {
  DispatchPrintJobRequestInput,
  PrinterTelemetryRequestInput,
  RoutePrintJobRequestInput,
  SyncPrintersRequestInput,
  UpdatePrinterPresetRequestInput,
} from "@ctrlp/schemas";
import type { AuthSessionUser } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { getShopOrder } from "@/src/modules/orders/order.service";
import { parsePageSelection } from "@/src/modules/printing/page-selection";

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

function printerCapabilities(printer: SyncPrintersRequestInput["printers"][number]) {
  const capabilities = [];
  if (printer.supportsA4 !== false) {
    capabilities.push("A4");
  }
  if (printer.supportsA3) {
    capabilities.push("A3");
  }
  if (printer.isColorCapable) {
    capabilities.push("COLOR");
  }
  return capabilities;
}

function defaultSettings(isColorCapable: boolean): PrintSettings {
  return {
    colorMode: isColorCapable ? "COLOR" : "BW",
    copies: 1,
    paperSize: "A4",
    pageSelection: "all",
    inputTray: "AUTO",
  };
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

export async function syncShopPrinters(user: AuthSessionUser, input: SyncPrintersRequestInput) {
  const db = getFirebaseFirestore();
  const printers = [];

  for (const printer of input.printers) {
    const id = printerIdFor(printer.name);
    const reference = db.doc(`shops/${user.shopId}/printers/${id}`);
    const existing = await reference.get();
    const defaults = defaultSettings(printer.isColorCapable);
    const now = FieldValue.serverTimestamp();

    await reference.set(
      {
        id,
        shopId: user.shopId,
        name: printer.name,
        systemName: printer.systemName ?? printer.name,
        driverName: printer.driverName ?? "",
        portName: printer.portName ?? "",
        isColorCapable: printer.isColorCapable,
        isDuplexCapable: printer.isDuplexCapable ?? false,
        capabilities: printerCapabilities(printer),
        maximumCopies: printer.maximumCopies,
        status: printer.status ?? "ONLINE",
        statusReason: printer.statusReason ?? null,
        activeSpoolJobs: printer.activeSpoolJobs ?? 0,
        duplex: false,
        ...(existing.exists
          ? {}
          : { defaultPrintSettings: defaults, isDefault: printer.isDefault, createdAt: now }),
        updatedAt: now,
      },
      { merge: true },
    );

    const saved = await reference.get();
    printers.push({
      id,
      name: printer.name,
      isColorCapable: printer.isColorCapable,
      maximumCopies: printer.maximumCopies,
      isDefault: saved.get("isDefault") === true,
      defaultPrintSettings: readPreset(saved.get("defaultPrintSettings"), defaults),
    });
  }

  return { printers };
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
  }) as { pageCount?: number; config?: Record<string, unknown> } | undefined;

  if (!document) {
    throw new AuthServiceError(404, "DOCUMENT_NOT_FOUND");
  }

  const db = getFirebaseFirestore();
  const printerRef = db.doc(`shops/${user.shopId}/printers/${input.printerId}`);
  const jobId = randomUUID();
  const jobRef = db.doc(`shops/${user.shopId}/orders/${orderId}/printJobs/${jobId}`);
  let colorWarning = false;

  await db.runTransaction(async (transaction) => {
    const printerSnap = await transaction.get(printerRef);
    if (!printerSnap.exists) {
      throw new AuthServiceError(404, "printer is not registered");
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

    colorWarning = resolved.colorMode === "COLOR" && printerSnap.get("isColorCapable") !== true;
    const pages = parsePageSelection(resolved.pageSelection, document.pageCount ?? 1);

    transaction.set(jobRef, {
      id: jobId,
      orderId,
      shopId: user.shopId,
      documentId: input.documentId,
      printerId: input.printerId,
      printerName: printerSnap.get("name") ?? "",
      requestedOverrides,
      resolvedSettings: {
        ...resolved,
        duplex: false,
        billablePageCount: pages.length,
      },
      status: "QUEUED",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const saved = await jobRef.get();
  return {
    jobId,
    colorWarning,
    requestedOverrides: saved.get("requestedOverrides"),
    resolvedSettings: saved.get("resolvedSettings"),
    status: "QUEUED",
  };
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
