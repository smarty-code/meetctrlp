import { z } from "zod";

// Board, history and search queries (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.4).

const orderStatuses = ["SUBMITTED", "SHOP_ACCEPTED", "PRINTING", "READY", "COMPLETED", "REJECTED", "CANCELLED"] as const;
const shopDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dates are YYYY-MM-DD");

/** `GET .../board?since=<cursor>`. Without `since`, the full board. */
export const boardQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

/** `GET .../orders?status=A,B&from=YYYY-MM-DD&to=YYYY-MM-DD&cursor=&limit=`. Dates are in shop time. */
export const orderHistoryQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").map((part) => part.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(orderStatuses)).max(7)),
  from: shopDate.optional(),
  to: shopDate.optional(),
  cursor: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** `GET .../orders/search?q=&cursor=`: exact search terms of 3 or more characters. */
export const orderSearchQuerySchema = z.object({
  q: z.string().trim().min(3, "search needs at least 3 characters").max(64).transform((value) => value.toLowerCase()),
  cursor: z.string().trim().min(1).max(80).optional(),
});

export type BoardQueryInput = z.infer<typeof boardQuerySchema>;
export type OrderHistoryQueryInput = z.infer<typeof orderHistoryQuerySchema>;
export type OrderSearchQueryInput = z.infer<typeof orderSearchQuerySchema>;
