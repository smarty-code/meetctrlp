import { z } from "zod";

export const printUserUploadIntentRequestSchema = z.object({
  originalFilename: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(127),
  fileSizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
});

export const printUserPrintConfigurationSchema = z.object({
  colorMode: z.enum(["BW", "COLOR"]),
  copies: z.number().int().positive().max(999),
  paperSize: z.enum(["A4", "A3"]),
  orientation: z.enum(["PORTRAIT", "LANDSCAPE"]).optional(),
  pageSelection: z.object({
    mode: z.enum(["all", "selected"]),
    expression: z.string().max(200).optional().default(""),
  }),
});

export const printUserSubmitOrderRequestSchema = z.object({
  paymentMethod: z.enum(["CASH", "ONLINE"]),
  idempotencyKey: z.string().trim().min(8).max(128),
  expectedTotalPaise: z.number().int().nonnegative().optional(),
});

export const printUserMockConfirmRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
});

export type PrintUserUploadIntentRequestInput = z.infer<
  typeof printUserUploadIntentRequestSchema
>;
export type PrintUserPrintConfigurationInput = z.infer<
  typeof printUserPrintConfigurationSchema
>;
export type PrintUserSubmitOrderRequestInput = z.infer<
  typeof printUserSubmitOrderRequestSchema
>;
export type PrintUserMockConfirmRequestInput = z.infer<
  typeof printUserMockConfirmRequestSchema
>;
