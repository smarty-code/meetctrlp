import { z } from "zod";

const printSettingsSchema = z.object({
  colorMode: z.enum(["BW", "COLOR"]),
  copies: z.number().int().min(1).max(999),
  paperSize: z.enum(["A4", "A3"]),
  pageSelection: z.string().trim().min(1).max(200),
  inputTray: z.string().trim().min(1).max(40),
});

export const syncPrintersRequestSchema = z.object({
  printers: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        systemName: z.string().trim().min(1).max(200).optional(),
        driverName: z.string().trim().max(255).optional(),
        portName: z.string().trim().max(150).optional(),
        isColorCapable: z.boolean(),
        isDuplexCapable: z.boolean().optional(),
        supportsA4: z.boolean().optional(),
        supportsA3: z.boolean().optional(),
        maximumCopies: z.number().int().min(1).max(999),
        isDefault: z.boolean(),
        status: z.enum(["ONLINE", "OFFLINE", "PRINTING", "ERROR"]).optional(),
        statusReason: z.string().trim().max(200).nullable().optional(),
        activeSpoolJobs: z.number().int().min(0).max(10_000).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const updatePrinterPresetRequestSchema = z.object({
  isDefault: z.boolean(),
  colorMode: z.enum(["BW", "COLOR"]),
  copies: z.number().int().min(1).max(999),
  paperSize: z.enum(["A4", "A3"]),
  orientation: z.enum(["PORTRAIT", "LANDSCAPE"]),
  inputTray: z.enum(["AUTO_SELECT", "MAIN_TRAY", "BYPASS_TRAY", "TRAY_1", "TRAY_2", "TRAY_3"]),
  printQualityDpi: z.enum(["DRAFT_300DPI", "STANDARD_600DPI", "HIGH_1200DPI"]),
});

export const printerTelemetryRequestSchema = z.object({
  previousStatus: z.enum(["ONLINE", "OFFLINE", "PRINTING", "ERROR"]),
  newStatus: z.enum(["ONLINE", "OFFLINE", "PRINTING", "ERROR"]),
  errorCode: z.string().trim().max(40).nullable().optional(),
  errorDescription: z.string().trim().max(200).nullable().optional(),
  activeSpoolJobs: z.number().int().min(0).max(10_000),
});

export const routePrintJobRequestSchema = z.object({
  colorMode: z.enum(["BW", "COLOR"]),
  paperSize: z.enum(["A4", "A3"]),
});

export const dispatchPrintJobRequestSchema = z.object({
  printerId: z.string().trim().min(8).max(64),
  documentId: z.string().trim().min(1).max(80),
  overrides: z
    .object({
      colorMode: z.enum(["BW", "COLOR"]).optional(),
      copies: z.number().int().min(1).max(999).optional(),
      paperSize: z.enum(["A4", "A3"]).optional(),
      pageSelection: z.string().trim().min(1).max(200).optional(),
      inputTray: z.string().trim().min(1).max(40).optional(),
      duplex: z.boolean().optional(),
    })
    .default({}),
});

export type SyncPrintersRequestInput = z.infer<typeof syncPrintersRequestSchema>;
export type PrinterTelemetryRequestInput = z.infer<typeof printerTelemetryRequestSchema>;
export type RoutePrintJobRequestInput = z.infer<typeof routePrintJobRequestSchema>;
export type UpdatePrinterPresetRequestInput = z.infer<typeof updatePrinterPresetRequestSchema>;
export type DispatchPrintJobRequestInput = z.infer<typeof dispatchPrintJobRequestSchema>;
