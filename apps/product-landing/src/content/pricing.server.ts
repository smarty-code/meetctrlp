import "server-only"

/**
 * Plan tiers for the hidden pricing layout (PRD 5.8). Server-only so these values never reach
 * a client bundle; they render only when `flags.showPricing` is true.
 */
export type PlanTier = {
  readonly name: string
  readonly perDay: number
  readonly perMonth: number
  readonly for: string
}

export const plans = [
  { name: "Starter", perDay: 9, perMonth: 270, for: "Small shops" },
  { name: "Pro", perDay: 14, perMonth: 420, for: "Busy print and Xerox shops" },
  { name: "Business", perDay: 19, perMonth: 570, for: "High-volume shops" },
] as const satisfies readonly PlanTier[]
