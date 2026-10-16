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

/** Saves print settings for every document in the guest cart in one request. */
export const printUserBatchConfigurationSchema = z.object({
  documents: z
    .array(
      printUserPrintConfigurationSchema.extend({
        documentId: z.string().trim().min(1).max(128),
      }),
    )
    .min(1)
    .max(10),
});

export const printUserSubmitOrderRequestSchema = z.object({
  paymentMethod: z.enum(["CASH", "ONLINE"]),
  idempotencyKey: z.string().trim().min(8).max(128),
  expectedTotalPaise: z.number().int().nonnegative().optional(),
});

export const printUserMockConfirmRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
});

/** `DELETE /public/session/documents/{docId}`. `removed` is false when it was already gone. */
export type PrintUserDeleteDocumentResponse = { ok: true; removed: boolean };

/** `DELETE /public/session/documents`: empties the cart. `removed` counts the entries taken out. */
export type PrintUserClearCartResponse = { ok: true; removed: number };

/**
 * Cart errors the web app tells apart, sent as the response's `error`:
 * - `ALREADY_ORDERED` (409): the document left the cart in the guest's order, so it can't be deleted.
 * - `DOCUMENTS_STILL_UPLOADING` (409): submit refused while a cart file is still uploading.
 */
export type PrintUserCartErrorCode = "ALREADY_ORDERED" | "DOCUMENTS_STILL_UPLOADING";

export type PrintUserUploadIntentRequestInput = z.infer<
  typeof printUserUploadIntentRequestSchema
>;
export type PrintUserPrintConfigurationInput = z.infer<
  typeof printUserPrintConfigurationSchema
>;
export type PrintUserBatchConfigurationInput = z.infer<
  typeof printUserBatchConfigurationSchema
>;
export type PrintUserSubmitOrderRequestInput = z.infer<
  typeof printUserSubmitOrderRequestSchema
>;
export type PrintUserMockConfirmRequestInput = z.infer<
  typeof printUserMockConfirmRequestSchema
>;
