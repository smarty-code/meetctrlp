import { z } from "zod"

/**
 * Environment configuration schema & validator
 * Governed by PRD Section 9.8
 */
const envSchema = z.object({
  // Public client variables (prefixed with NEXT_PUBLIC_)
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://meetctrlp.in"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("https://app.meetctrlp.in"),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z
    .string()
    .default("919876543210"),
  NEXT_PUBLIC_CONTACT_EMAIL: z
    .string()
    .email()
    .default("hello@meetctrlp.in"),
  NEXT_PUBLIC_FOUNDER_NAME: z.string().default("Amit Pramanik"),
  NEXT_PUBLIC_SHOW_JOURNEY: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  // Server-only private variables
  LEAD_WEBHOOK_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(5).optional(),
  LEAD_NOTIFICATION_EMAIL: z.string().email().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export const env: Env = envSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  NEXT_PUBLIC_FOUNDER_NAME: process.env.NEXT_PUBLIC_FOUNDER_NAME,
  NEXT_PUBLIC_SHOW_JOURNEY: process.env.NEXT_PUBLIC_SHOW_JOURNEY,
  LEAD_WEBHOOK_URL: process.env.LEAD_WEBHOOK_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  LEAD_NOTIFICATION_EMAIL: process.env.LEAD_NOTIFICATION_EMAIL,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
})

export const isDev = process.env.NODE_ENV === "development"

