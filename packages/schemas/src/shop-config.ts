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
export type UpdateShopHoursRequestInput = z.infer<typeof updateShopHoursRequestSchema>;
export type PriceQuoteRequestInput = z.infer<typeof priceQuoteRequestSchema>;
