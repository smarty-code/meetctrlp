import { NextResponse } from "next/server"

// Simple in-memory rate limiter: 5 requests per hour per IP
const ipRequests = new Map<string, { count: number; resetTime: number }>()

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
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

    const body = await request.json()
    const { name, phone, shopName, website_hp } = body

    // 1. Honeypot check (bots fill hidden field)
    if (website_hp) {
      // Silently return success to bot without doing anything
      return NextResponse.json({ success: true })
    }

    // 2. Validate Name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 }
      )
    }

    // 3. Validate Phone (10 digits for India with optional +91)
    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "Phone number is required." },
        { status: 400 }
      )
    }

    const cleanPhone = phone.replace(/[\s\-()]/g, "")
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/
    if (!phoneRegex.test(cleanPhone)) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit Indian mobile number." },
        { status: 400 }
      )
    }

    // Delivery: Can be wired up to Resend / Webhook in production
    if (process.env.LEAD_WEBHOOK_URL) {
      await fetch(process.env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          shopName: shopName ? String(shopName).trim() : null,
          timestamp: new Date().toISOString(),
        }),
      }).catch((err) => {
        console.error("Failed to forward lead to webhook:", err)
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Request-call submission error:", err)
    return NextResponse.json(
      { error: "Something went wrong. Please try WhatsApp instead." },
      { status: 500 }
    )
  }
}
