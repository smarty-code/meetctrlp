import { env } from "@/config/env"

/** Feature flags (PRD 9.3). Components check these; they never read process.env. */
export const flags = {
  /** Three-tier price layout. Off until pricing is validated with shop owners (PRD 5.8). */
  showPricing: env.NEXT_PUBLIC_SHOW_PRICING,
  analytics: env.NEXT_PUBLIC_ANALYTICS_DOMAIN !== undefined,
} as const
