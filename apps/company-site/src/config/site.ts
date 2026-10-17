import { env } from "./env"
import { routes, getWhatsAppUrl, getMailtoUrl } from "./routes"

/**
 * Site Configuration for MeetCtrlP
 * Governed by PRD Section 1, 3, 5, 8, 9.3
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
    base: env.NEXT_PUBLIC_SITE_URL,
    app: env.NEXT_PUBLIC_APP_URL,
    journey: routes.journey,
    printUser: routes.printUser,
    printShops: routes.printShops,
    privacy: routes.privacy,
    terms: routes.terms,
    howItWorks: routes.howItWorks,
    contact: routes.contact,
  },
  contact: {
    whatsappNumber: env.NEXT_PUBLIC_WHATSAPP_NUMBER,
    email: env.NEXT_PUBLIC_CONTACT_EMAIL,
    founderName: env.NEXT_PUBLIC_FOUNDER_NAME,
  },
  features: {
    showJourney: env.NEXT_PUBLIC_SHOW_JOURNEY,
  },
  seo: {
    title: "MeetCtrlP | CtrlP, a simpler way to print",
    description:
      "CtrlP connects people who need prints with the local shops that make them happen. A simpler way to send documents and manage print jobs.",
    locale: "en_IN",
    themeColor: "#F8F9F8",
  },
} as const

export { getWhatsAppUrl, getMailtoUrl }
export { getWhatsAppUrl as getWhatsAppContactUrl, getMailtoUrl as getMailtoContactUrl }
