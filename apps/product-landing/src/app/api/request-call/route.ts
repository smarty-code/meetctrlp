import { NextResponse } from "next/server"
import { formCopy } from "@/content/meta"
import { callRequestSchema, type CallResponse } from "@/lib/validation"
import { allowRequest, clientKey } from "@/lib/rateLimit"
import { deliverLead, hasDeliveryChannel } from "@/lib/leads.server"

/**
 * Request-a-call endpoint (PRD 5.12, 9.8): zod validation, honeypot, 5 per hour per IP,
 * delivery to the configured webhook and/or email. Errors never leak internals,
 * and contact details are never logged or sent to analytics.
 */
function reply(body: CallResponse, status: number) {
  return NextResponse.json(body, { status })
}

export async function POST(request: Request) {
  if (!allowRequest(clientKey(request.headers))) {
    return reply({ ok: false, error: formCopy.errors.tooMany }, 429)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return reply({ ok: false, error: formCopy.error }, 400)
  }

  const parsed = callRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return reply(
      { ok: false, error: parsed.error.issues[0]?.message ?? formCopy.error },
      400
    )
  }

  // Honeypot filled: answer like a success so bots learn nothing.
  if (parsed.data.website !== "") return reply({ ok: true }, 200)

  if (!hasDeliveryChannel())
    return reply({ ok: false, error: formCopy.error }, 503)

  const delivered = await deliverLead(parsed.data)
  return delivered
    ? reply({ ok: true }, 200)
    : reply({ ok: false, error: formCopy.error }, 502)
}
