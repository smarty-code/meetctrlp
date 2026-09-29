import { z } from "zod";

const paiseSchema = z.number().int().min(50).max(10_000);

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use 24-hour HH:mm");

export const updateShopPricingRequestSchema = z.object({
  bwA4PricePaise: paiseSchema,
  colorA4PricePaise: paiseSchema,
  colorA3PricePaise: paiseSchema,
});

export const updateShopCapabilitiesRequestSchema = z.object({
  colorPrinting: z.boolean(),
  a3Printing: z.boolean(),
});

export const updateOrderAutomationRequestSchema = z.object({
  autoAcceptPaidOnline: z.boolean(),
  autoDispatchAcceptedOrders: z.boolean(),
  cashRequiresOperatorAcceptance: z.literal(true),
});

export const businessHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: timeSchema,
    closesAt: timeSchema,
    isClosed: z.boolean(),
  })
  .refine((hour) => hour.isClosed || hour.opensAt < hour.closesAt, {
    message: "closing time must be after opening time",
    path: ["closesAt"],
  });

export const updateShopHoursRequestSchema = z
  .object({
    businessHours: z.array(businessHourSchema).length(7),
  })
  .refine(
    (value) => new Set(value.businessHours.map((hour) => hour.dayOfWeek)).size === 7,
    { message: "business hours must include each day once", path: ["businessHours"] },
  );

export const shopAddressSchema = z.object({
  line1: z.string().trim().max(120).optional().nullable(),
  line2: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(80).optional().nullable(),
  postalCode: z.string().trim().max(12).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
});

export const updateShopProfileRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .union([z.string().trim().min(8).max(20), z.literal(""), z.null()])
    .transform((value) => (value ? value : null)),
  email: z
    .union([z.string().trim().email().max(120), z.literal(""), z.null()])
    .transform((value) => (value ? value : null)),
  address: shopAddressSchema,
});

export const priceQuoteRequestSchema = z.object({
  billablePages: z.number().int().positive().max(10_000),
  copies: z.number().int().positive().max(999),
  colorMode: z.enum(["BW", "COLOR"]),
  paperSize: z.enum(["A4", "A3"]),
});

export type UpdateShopPricingRequestInput = z.infer<typeof updateShopPricingRequestSchema>;
export type UpdateShopCapabilitiesRequestInput = z.infer<
  typeof updateShopCapabilitiesRequestSchema
>;
export type UpdateOrderAutomationRequestInput = z.infer<typeof updateOrderAutomationRequestSchema>;
export type UpdateShopHoursRequestInput = z.infer<typeof updateShopHoursRequestSchema>;
export type UpdateShopProfileRequestInput = z.infer<typeof updateShopProfileRequestSchema>;
export type ShopAddressInput = z.infer<typeof shopAddressSchema>;
export type PriceQuoteRequestInput = z.infer<typeof priceQuoteRequestSchema>;
