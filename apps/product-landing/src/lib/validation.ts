import { z } from "zod"
import { formCopy } from "@/content/meta"

const { errors } = formCopy

/** Strips spaces, dashes and brackets, then an optional +91 / 91 prefix. */
export function normalisePhone(raw: string): string {
  const compact = raw.replace(/[\s\-()]/g, "")
  return compact.replace(/^(\+91|91)(?=\d{10}$)/, "")
}

export const nameMaxLength = 80
export const optionalMaxLength = 100

/** Request-a-call input, shared by the modal and the route handler (PRD 5.12, 9.9). */
export const callRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, errors.nameRequired)
    .max(nameMaxLength, errors.nameTooLong),
  phone: z
    .string()
    .transform(normalisePhone)
    .refine((value) => /^\d{10}$/.test(value), errors.phoneInvalid),
  shopName: z
    .string()
    .trim()
    .max(optionalMaxLength, errors.optionalTooLong)
    .optional()
    .default(""),
  city: z
    .string()
    .trim()
    .max(optionalMaxLength, errors.optionalTooLong)
    .optional()
    .default(""),
  /** Honeypot: real people never see or fill it. */
  website: z.string().optional().default(""),
})

export type CallRequestInput = z.input<typeof callRequestSchema>
export type CallRequest = z.output<typeof callRequestSchema>

export type CallRequestFieldErrors = Partial<
  Record<"name" | "phone" | "shopName" | "city", string>
>

export function fieldErrors(
  error: z.ZodError<CallRequestInput>
): CallRequestFieldErrors {
  const flat = error.flatten().fieldErrors
  return {
    ...(flat.name?.[0] ? { name: flat.name[0] } : {}),
    ...(flat.phone?.[0] ? { phone: flat.phone[0] } : {}),
    ...(flat.shopName?.[0] ? { shopName: flat.shopName[0] } : {}),
    ...(flat.city?.[0] ? { city: flat.city[0] } : {}),
  }
}

export const callResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

export type CallResponse = z.infer<typeof callResponseSchema>
