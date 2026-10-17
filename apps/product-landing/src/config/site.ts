import { env } from "@/config/env"

const siteUrl = `https://${env.NEXT_PUBLIC_SITE_DOMAIN}`
const mainSiteUrl = env.NEXT_PUBLIC_MAIN_SITE_URL.replace(/\/$/, "")
const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")

/** Business values and external URLs (PRD 9.3). Build every link from here. */
export const site = {
  url: siteUrl,
  domain: env.NEXT_PUBLIC_SITE_DOMAIN,
  locale: "en-IN",
  ogLocale: "en_IN",
  themeColor: "#F8F9F8", // audit-ignore-line: metadata needs a literal; mirrors --color-bg
  appUrl: `${appUrl}/`,
  mainSiteUrl: `${mainSiteUrl}/`,
  // TODO(owner): confirm these main-site legal pages, or supply this site's own policy text (PRD 3.2, 10.3).
  mainSitePrivacyUrl: `${mainSiteUrl}/privacy`,
  mainSiteTermsUrl: `${mainSiteUrl}/terms`,
  whatsappNumber: env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL,
  whatsappBaseUrl: "https://wa.me/",
  analytics: {
    domain: env.NEXT_PUBLIC_ANALYTICS_DOMAIN,
    scriptUrl: "https://plausible.io/js/script.js",
  },
  schemaContext: "https://schema.org",
  /** Google Fonts CSS for the OG image renderer (it cannot use next/font). */
  ogFontCssUrl: "https://fonts.googleapis.com/css2?family=Instrument+Serif",
} as const
