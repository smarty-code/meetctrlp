/**
 * Site Configuration for MeetCtrlP
 * Governed by PRD Section 1, 3, 5, 8, 9.
 * All values are dynamic and configurable via environment variables.
 */

export const siteConfig = {
  brand: {
    name: "MeetCtrlP",
    product: "CtrlP",
    tagline: "Thoughtful software for everyday work.",
    shortDescription: "A simpler way to print.",
    copyrightYear: 2026,
  },
  urls: {
    base: process.env.NEXT_PUBLIC_SITE_URL || "https://meetctrlp.in",
    app: process.env.NEXT_PUBLIC_APP_URL || "https://app.meetctrlp.in",
    journey: "/journey",
    printUser: "/print",
    printShops: "/print-shops",
    privacy: "/privacy",
    terms: "/terms",
    howItWorks: "/#how-it-works",
    contact: "/#contact",
  },
  contact: {
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919876543210",
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@meetctrlp.in",
    founderName: process.env.NEXT_PUBLIC_FOUNDER_NAME || "Amit Pramanik",
  },
  features: {
    // Governed by PRD Section 3.1: Behind flag NEXT_PUBLIC_SHOW_JOURNEY (default false)
    showJourney: process.env.NEXT_PUBLIC_SHOW_JOURNEY === "true",
  },
  seo: {
    title: "MeetCtrlP | CtrlP, a simpler way to print",
    description:
      "CtrlP connects people who need prints with the local shops that make them happen. A simpler way to send documents and manage print jobs.",
    locale: "en_IN",
    themeColor: "#F8F9F8",
  },
} as const

/**
 * Builds the WhatsApp prefilled link dynamically adhering to PRD Section 5.8
 */
export function getWhatsAppContactUrl(customText?: string): string {
  const defaultText =
    "Hi MeetCtrlP, I run a print shop and I'd like to know more about CtrlP."
  const message = encodeURIComponent(customText || defaultText)
  const number = siteConfig.contact.whatsappNumber.replace(/[^0-9]/g, "")
  return `https://wa.me/${number}?text=${message}`
}

/**
 * Mailto contact URL generator
 */
export function getMailtoContactUrl(subject?: string): string {
  const mailSubject = encodeURIComponent(subject || "MeetCtrlP Enquiry")
  return `mailto:${siteConfig.contact.email}?subject=${mailSubject}`
}
