import "server-only"
import { z } from "zod"

/**
 * Server-only environment for lead delivery (PRD 5.12, 9.12).
 * All optional so the site builds without them; the call route reports
 * a delivery error when no channel is configured.
 */
const serverEnvSchema = z.object({
  LEAD_WEBHOOK_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  LEAD_NOTIFICATION_EMAIL: z.string().email().optional(),
  LEAD_FROM_EMAIL: z.string().email().optional(),
})

export const serverEnv = serverEnvSchema.parse({
  LEAD_WEBHOOK_URL: process.env.LEAD_WEBHOOK_URL || undefined,
  RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
  LEAD_NOTIFICATION_EMAIL: process.env.LEAD_NOTIFICATION_EMAIL || undefined,
  LEAD_FROM_EMAIL: process.env.LEAD_FROM_EMAIL || undefined,
})

export const resendApiUrl = "https://api.resend.com/emails"
