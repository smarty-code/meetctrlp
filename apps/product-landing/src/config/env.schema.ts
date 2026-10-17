import { z } from "zod"

/**
 * Public environment schema (PRD 9.3, 9.12). `next.config.ts` runs `validatePublicEnv`, so a missing
 * or malformed value fails `next build` and `next start`. Kept out of `env.ts` so zod never ships
 * to the browser.
 */
const booleanFlag = z.enum(["true", "false"]).optional()

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_DOMAIN: z
    .string({ required_error: "NEXT_PUBLIC_SITE_DOMAIN is required" })
    .regex(
      /^[a-z0-9.-]+(:\d+)?$/i,
      "Use a bare host name, for example shops.meetctrlp.in"
    ),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z
    .string({ required_error: "NEXT_PUBLIC_WHATSAPP_NUMBER is required" })
    .regex(
      /^91[6-9]\d{9}$/,
      "Use the verified business number as 91 followed by 10 digits"
    ),
  NEXT_PUBLIC_CONTACT_EMAIL: z
    .string({ required_error: "NEXT_PUBLIC_CONTACT_EMAIL is required" })
    .email(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_MAIN_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SHOW_PRICING: booleanFlag,
  NEXT_PUBLIC_ANALYTICS_DOMAIN: z.string().min(1).optional(),
})

/** Throws with every problem listed when the public environment is invalid. */
export function validatePublicEnv(
  source: Record<string, string | undefined>
): void {
  const values = Object.fromEntries(
    Object.keys(publicEnvSchema.shape).map((key) => [
      key,
      source[key] === "" ? undefined : source[key],
    ])
  )
  const result = publicEnvSchema.safeParse(values)
  if (result.success) return
  const problems = result.error.issues.map(
    (issue) => `  - ${issue.path.join(".")}: ${issue.message}`
  )
  throw new Error(
    `Invalid environment (see .env.example):\n${problems.join("\n")}`
  )
}
