import { env } from "./env"

/**
 * Route dictionary and external URL builders
 * Governed by PRD Section 3.1 & 9.3
 */
export const routes = {
  home: "/",
  howItWorks: "/#how-it-works",
  contact: "/#contact",
  printUser: "/print",
  printShops: "/print-shops",
  journey: "/journey",
  privacy: "/privacy",
  terms: "/terms",
  api: {
    requestCall: "/api/request-call",
    health: "/api/health",
  },
} as const

export function getWhatsAppUrl(customMessage?: string): string {
  const defaultText =
    "Hi MeetCtrlP, I run a print shop and I'd like to know more about CtrlP."
  const message = encodeURIComponent(customMessage || defaultText)
  const phone = env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, "")
  return `https://wa.me/${phone}?text=${message}`
}

export function getMailtoUrl(subject?: string): string {
  const mailSubject = encodeURIComponent(subject || "MeetCtrlP Enquiry")
  return `mailto:${env.NEXT_PUBLIC_CONTACT_EMAIL}?subject=${mailSubject}`
}
