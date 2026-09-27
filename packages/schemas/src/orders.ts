import { z } from "zod";

const orderStatusSchema = z.enum([
  "SUBMITTED",
  "SHOP_ACCEPTED",
  "PRINTING",
  "READY",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
]);

export const checkoutDocumentSchema = z.object({
  originalFilename: z.string().trim().min(1).max(200),
  pageCount: z.number().int().positive().max(10_000),
  copies: z.number().int().positive().max(999),
  colorMode: z.enum(["BW", "COLOR"]),
  paperSize: z.enum(["A4", "A3"]),
});

export const checkoutOrderRequestSchema = z.object({
  printUserId: z.string().trim().min(1).max(128).optional(),
  customerPhone: z.string().trim().min(8).max(32).optional(),
  paymentMethod: z.enum(["CASH", "ONLINE"]),
  documents: z.array(checkoutDocumentSchema).min(1).max(20),
});

export const orderTransitionRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  currentStatus: orderStatusSchema,
});

export const rejectOrderRequestSchema = orderTransitionRequestSchema.extend({
  category: z.enum([
    "OUT_OF_PAPER",
    "INVALID_DOCUMENT",
    "HARDWARE_FAULT",
    "SHOP_CLOSED",
    "OTHER",
  ]),
  reason: z.string().trim().min(1).max(200),
});

export type CheckoutOrderRequestInput = z.infer<typeof checkoutOrderRequestSchema>;
export type OrderTransitionRequestInput = z.infer<typeof orderTransitionRequestSchema>;
export type RejectOrderRequestInput = z.infer<typeof rejectOrderRequestSchema>;
