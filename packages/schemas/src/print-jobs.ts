import { z } from "zod";

export const printerStatusSchema = z.enum(["ONLINE", "OFFLINE", "PRINTING", "ERROR", "PAUSED"]);

export const printerOfferedSchema = z.object({
  bw: z.boolean(),
  color: z.boolean(),
  a4: z.boolean(),
  a3: z.boolean(),
});

const printerOptionsSchema = z
  .object({
    colorModes: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    paperSizes: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
    paperSizeLabels: z.array(z.string().trim().min(1).max(80)).max(80).optional(),
    orientations: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
    duplexModes: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
    inputTrays: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    printQualities: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    copiesMin: z.number().int().min(1).max(999).optional(),
    copiesMax: z.number().int().min(1).max(999).optional(),
    currentColorMode: z.string().trim().max(40).nullable().optional(),
    currentPaperSize: z.string().trim().max(40).nullable().optional(),
    currentOrientation: z.string().trim().max(40).nullable().optional(),
    currentInputTray: z.string().trim().max(40).nullable().optional(),
    currentPrintQuality: z.string().trim().max(40).nullable().optional(),
    currentCopies: z.number().int().min(1).max(999).optional(),
    raw: z.array(z.string().trim().min(1).max(120)).max(120).optional(),
  })
  .passthrough();

export const syncPrintersRequestSchema = z.object({
  agentId: z.string().trim().min(8).max(64),
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
        supportedPaperSizes: z.array(z.enum(["A4", "A3"])).max(8).optional(),
        maximumCopies: z.number().int().min(1).max(999),
        isDefault: z.boolean(),
        status: printerStatusSchema.optional(),
        statusReason: z.string().trim().max(200).nullable().optional(),
        activeSpoolJobs: z.number().int().min(0).max(10_000).optional(),
        activeJobsCount: z.number().int().min(0).max(10_000).optional(),
        options: printerOptionsSchema.optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const updatePrinterConfigRequestSchema = z
  .object({
    isDefault: z.boolean().optional(),
    enabled: z.boolean().optional(),
    offered: z
      .object({
        color: z.boolean().optional(),
        a3: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => value.isDefault !== undefined || value.enabled !== undefined || value.offered !== undefined, {
    message: "isDefault, enabled, or offered is required",
  });

export type PrinterOffered = z.infer<typeof printerOfferedSchema>;

export function defaultPrinterOffered(hardware: { isColorCapable: boolean; supportsA3: boolean }): PrinterOffered {
  return {
    bw: true,
    color: hardware.isColorCapable,
    a4: true,
    a3: hardware.supportsA3,
  };
}

export function assertOfferWithinHardware(
  offered: { color?: boolean; a3?: boolean },
  hardware: { isColorCapable: boolean; supportsA3: boolean },
) {
  if (offered.color === true && !hardware.isColorCapable) {
    throw new Error("this printer cannot offer color");
  }
  if (offered.a3 === true && !hardware.supportsA3) {
    throw new Error("this printer cannot offer A3");
  }
}

export function shopPrinterCapabilityList(input: {
  enabled: boolean;
  isColorCapable: boolean;
  supportsA4: boolean;
  supportsA3: boolean;
  offered: PrinterOffered;
}) {
  if (!input.enabled) {
    return [];
  }

  const capabilities: string[] = [];
  if (input.offered.a4 && input.supportsA4) {
    capabilities.push("A4");
  }
  if (input.offered.a3 && input.supportsA3) {
    capabilities.push("A3");
  }
  if (input.offered.color && input.isColorCapable) {
    capabilities.push("COLOR");
  }
  return capabilities;
}

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
  previousStatus: printerStatusSchema,
  newStatus: printerStatusSchema,
  errorCode: z.string().trim().max(40).nullable().optional(),
  errorDescription: z.string().trim().max(200).nullable().optional(),
  activeSpoolJobs: z.number().int().min(0).max(10_000),
});

export const routePrintJobRequestSchema = z.object({
  colorMode: z.enum(["BW", "COLOR"]),
  paperSize: z.enum(["A4", "A3"]),
});

export const printJobStatusSchema = z.enum([
  "QUEUED",
  "DISPATCHING",
  "PRINTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const dispatchPrintJobRequestSchema = z.object({
  printerId: z.string().trim().min(8).max(64),
  documentId: z.string().trim().min(1).max(80),
  idempotencyKey: z.string().trim().min(8).max(128),
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

export const updatePrintJobRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  status: printJobStatusSchema,
  pagesPrinted: z.number().int().min(0).max(100_000).optional(),
  spoolerJobId: z.number().int().positive().nullable().optional(),
  errorCode: z.string().trim().min(1).max(80).nullable().optional(),
  errorMessage: z.string().trim().min(1).max(500).nullable().optional(),
});

export const retryPrintJobRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  printerId: z.string().trim().min(8).max(64).optional(),
});

export type SyncPrintersRequestInput = z.infer<typeof syncPrintersRequestSchema>;
export type PrinterTelemetryRequestInput = z.infer<typeof printerTelemetryRequestSchema>;
export type RoutePrintJobRequestInput = z.infer<typeof routePrintJobRequestSchema>;
export type UpdatePrinterPresetRequestInput = z.infer<typeof updatePrinterPresetRequestSchema>;
export type UpdatePrinterConfigRequestInput = z.infer<typeof updatePrinterConfigRequestSchema>;
export type DispatchPrintJobRequestInput = z.infer<typeof dispatchPrintJobRequestSchema>;
export type UpdatePrintJobRequestInput = z.infer<typeof updatePrintJobRequestSchema>;
export type RetryPrintJobRequestInput = z.infer<typeof retryPrintJobRequestSchema>;
