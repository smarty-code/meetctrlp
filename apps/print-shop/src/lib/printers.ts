import { defaultPrinterOffered } from "@ctrlp/schemas"

import type { CloudPrinter, Printer, PrinterOffered } from "./protocol"

export const printerStatuses = ["ONLINE", "OFFLINE", "PRINTING", "ERROR", "PAUSED"] as const
export type CloudPrinterStatus = (typeof printerStatuses)[number]

export function cloudPrinterStatus(status: string): CloudPrinterStatus {
  const normalized = status.trim().toUpperCase()
  return printerStatuses.includes(normalized as CloudPrinterStatus)
    ? (normalized as CloudPrinterStatus)
    : "ONLINE"
}

export function hardwarePaper(printer: Printer) {
  const sizes = new Set(
    (printer.supportedPaperSizes ?? printer.options?.paperSizes ?? []).map((size) => size.toUpperCase())
  )
  return {
    supportsA4: sizes.has("A4") || sizes.size === 0,
    supportsA3: sizes.has("A3"),
  }
}

export function defaultOffered(printer: Printer): PrinterOffered {
  const paper = hardwarePaper(printer)
  const offered = defaultPrinterOffered({
    isColorCapable: printer.isColorCapable === true,
    supportsA3: paper.supportsA3,
  })
  return offered
}

export function mergeShopPrinters(local: Printer[], cloud: CloudPrinter[]): Printer[] {
  return local.map((printer) => {
    const match = cloud.find(
      (entry) =>
        namesMatch(entry.systemName, printer.systemName ?? printer.name) ||
        namesMatch(entry.name, printer.name) ||
        namesMatch(entry.id, printer.id)
    )
    const offered = match?.offered ?? defaultOffered(printer)
    return {
      ...printer,
      cloudId: match?.id,
      enabled: match?.enabled ?? true,
      offered,
      isShopDefault: match?.isDefault === true,
      capabilities: match?.capabilities,
      defaultPrintSettings: match?.defaultPrintSettings ?? printer.defaultPrintSettings,
    }
  })
}

export function mergeLiveStatus(current: Printer[], live: Printer[]): Printer[] {
  const known = new Map(current.map((printer) => [printer.name.toLowerCase(), printer]))
  return live.map((printer) => {
    const previous = known.get(printer.name.toLowerCase())
    if (!previous) {
      return {
        ...printer,
        enabled: true,
        offered: defaultOffered(printer),
        isShopDefault: false,
      }
    }
    return {
      ...previous,
      ...printer,
      cloudId: previous.cloudId,
      enabled: previous.enabled,
      offered: previous.offered,
      isShopDefault: previous.isShopDefault,
      capabilities: previous.capabilities,
      defaultPrintSettings: previous.defaultPrintSettings,
      options: printer.options ?? previous.options,
      isColorCapable: printer.isColorCapable ?? previous.isColorCapable,
      isDuplexCapable: printer.isDuplexCapable ?? previous.isDuplexCapable,
      supportedPaperSizes: printer.supportedPaperSizes ?? previous.supportedPaperSizes,
    }
  })
}

export function toSyncPrinter(printer: Printer) {
  const paper = hardwarePaper(printer)
  return {
    name: printer.name,
    systemName: printer.systemName ?? printer.name,
    driverName: printer.driverName ?? undefined,
    portName: printer.portName ?? undefined,
    isColorCapable: printer.isColorCapable === true,
    isDuplexCapable: printer.isDuplexCapable === true,
    supportsA4: paper.supportsA4,
    supportsA3: paper.supportsA3,
    supportedPaperSizes: [
      ...(paper.supportsA4 ? (["A4"] as const) : []),
      ...(paper.supportsA3 ? (["A3"] as const) : []),
    ],
    maximumCopies: Math.max(1, printer.maximumCopies ?? printer.options?.copiesMax ?? 1),
    isDefault: printer.isWindowsDefault === true || printer.isDefault,
    status: cloudPrinterStatus(printer.status),
    statusReason: printer.statusReason ?? null,
    activeJobsCount: printer.jobCount,
    options: printer.options ?? undefined,
  }
}

export function telemetrySignature(printer: Printer) {
  return [
    printer.cloudId ?? printer.id,
    cloudPrinterStatus(printer.status),
    printer.statusReason ?? "",
    String(printer.jobCount),
  ].join("|")
}

function namesMatch(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0)
}
