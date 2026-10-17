import { NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/config/env"
import { isValidIndianPhone, cleanPhoneNumber } from "@/lib/format"

/**
 * Lead Submission Schema
 * Governed by PRD Section 9.6
 */
export const LeadSubmissionSchema = z.object({
  name: z
    .string({ required_error: "Name is required." })
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name cannot exceed 80 characters."),
  phone: z
    .string({ required_error: "Phone number is required." })
    .trim()
    .transform((val) => cleanPhoneNumber(val))
    .refine((val) => isValidIndianPhone(val), {
      message: "Please enter a valid 10-digit Indian mobile number.",
    }),
  shopName: z.string().trim().max(100).optional().nullable(),
  website_hp: z.string().max(0, "Bot detected.").optional(), // Honeypot must remain empty
  timestamp: z
    .number()
    .optional()
    .refine((t) => !t || Date.now() - t >= 1000, {
      message: "Submission too fast.",
    }),
})

export type LeadSubmission = z.infer<typeof LeadSubmissionSchema>

// Serverless-safe fallback rate limiter (5 requests per hour per IP)
const ipRequests = new Map<string, { count: number; resetTime: number }>()

export async function POST(request: Request) {
  try {
    const forwardedHeader = request.headers.get("x-forwarded-for")
    const ip =
      forwardedHeader?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1"

    const now = Date.now()
    const record = ipRequests.get(ip)

    if (record) {
      if (now < record.resetTime) {
        if (record.count >= 5) {
          return NextResponse.json(
            { error: "Too many requests. Please try again later or contact us on WhatsApp." },
            { status: 429 }
          )
        }
        record.count += 1
      } else {
        ipRequests.set(ip, { count: 1, resetTime: now + 3600000 })
      }
    } else {
      ipRequests.set(ip, { count: 1, resetTime: now + 3600000 })
    }

    const rawBody = await request.json()
    const parseResult = LeadSubmissionSchema.safeParse(rawBody)

    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Validation failed."
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { name, phone, shopName, website_hp } = parseResult.data

    // Honeypot check: silently return 200 for bots
    if (website_hp) {
      return NextResponse.json({ success: true })
    }

    // Lead forwarding to configured webhook (Notion / Google Sheets)
    if (env.LEAD_WEBHOOK_URL) {
      try {
        await fetch(env.LEAD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone,
            shopName: shopName || null,
            timestamp: new Date().toISOString(),
          }),
        })
      } catch {
        // Silently capture webhook dispatch failure without exposing internals
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try WhatsApp instead." },
      { status: 500 }
    )
  }
}
