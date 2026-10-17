/**
 * Public environment (PRD 9.3, 9.12). Values are validated by `env.schema.ts` when `next.config.ts`
 * loads, so here they are only read and defaulted. Each variable is read by its full literal name
 * so Next.js can inline it into client bundles. Server secrets live in `env.server.ts`.
 */
const defaults = {
  appUrl: "https://app.meetctrlp.in",
  mainSiteUrl: "https://meetctrlp.in",
} as const

function value(raw: string | undefined): string | undefined {
  return raw === "" ? undefined : raw
}

export const env = {
  NEXT_PUBLIC_SITE_DOMAIN: process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "",
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
  NEXT_PUBLIC_APP_URL:
    value(process.env.NEXT_PUBLIC_APP_URL) ?? defaults.appUrl,
  NEXT_PUBLIC_MAIN_SITE_URL:
    value(process.env.NEXT_PUBLIC_MAIN_SITE_URL) ?? defaults.mainSiteUrl,
  NEXT_PUBLIC_SHOW_PRICING: process.env.NEXT_PUBLIC_SHOW_PRICING === "true",
  NEXT_PUBLIC_ANALYTICS_DOMAIN: value(process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN),
} as const

export type PublicEnv = typeof env
