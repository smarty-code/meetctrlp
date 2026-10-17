import "server-only"
import { resendApiUrl, serverEnv } from "@/config/env.server"
import type { CallRequest } from "@/lib/validation"

/** A lead without the honeypot, as delivered to the owner. */
type Lead = Omit<CallRequest, "website">

export function hasDeliveryChannel(): boolean {
  const email =
    serverEnv.RESEND_API_KEY &&
    serverEnv.LEAD_NOTIFICATION_EMAIL &&
    serverEnv.LEAD_FROM_EMAIL
  return Boolean(serverEnv.LEAD_WEBHOOK_URL || email)
}

async function postWebhook(
  url: string,
  lead: Lead,
  receivedAt: string
): Promise<boolean> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...lead, receivedAt }),
  })
  return response.ok
}

async function sendEmail(lead: Lead, receivedAt: string): Promise<boolean> {
  const { RESEND_API_KEY, LEAD_NOTIFICATION_EMAIL, LEAD_FROM_EMAIL } = serverEnv
  if (!RESEND_API_KEY || !LEAD_NOTIFICATION_EMAIL || !LEAD_FROM_EMAIL)
    return false
  const lines = [
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    `Shop: ${lead.shopName || "-"}`,
    `City: ${lead.city || "-"}`,
    `Received: ${receivedAt}`,
  ]
  const response = await fetch(resendApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: LEAD_FROM_EMAIL,
      to: LEAD_NOTIFICATION_EMAIL,
      subject: `Call request: ${lead.shopName || lead.name}`,
      text: lines.join("\n"),
    }),
  })
  return response.ok
}

/** Sends the lead to every configured channel; succeeds if at least one accepted it. */
export async function deliverLead(request: CallRequest): Promise<boolean> {
  const lead: Lead = {
    name: request.name,
    phone: request.phone,
    shopName: request.shopName,
    city: request.city,
  }
  const receivedAt = new Date().toISOString()
  const attempts: Array<Promise<boolean>> = []
  if (serverEnv.LEAD_WEBHOOK_URL)
    attempts.push(postWebhook(serverEnv.LEAD_WEBHOOK_URL, lead, receivedAt))
  attempts.push(sendEmail(lead, receivedAt))
  const results = await Promise.allSettled(attempts)
  return results.some((result) => result.status === "fulfilled" && result.value)
}
