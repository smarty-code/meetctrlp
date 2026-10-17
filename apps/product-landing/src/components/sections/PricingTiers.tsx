import "server-only"
import { plansCopy } from "@/content/copy"
import { plans } from "@/content/pricing.server"
import { fill, formatRupees } from "@/lib/format"

/**
 * Three-tier price layout, rendered only when `flags.showPricing` is true (PRD 5.8).
 * Server-only, so plan names and prices never reach a client bundle.
 */
export function PricingTiers() {
  return (
    <ul
      aria-label={plansCopy.tiersTitle}
      className="mx-auto grid w-full max-w-plans gap-4 md:grid-cols-3"
    >
      {plans.map((plan) => (
        <li
          key={plan.name}
          className="flex flex-col gap-2 rounded-lg bg-surface p-6 shadow-card"
        >
          <h3 className="text-h3 font-semibold">{plan.name}</h3>
          <p className="text-caption text-ink-faint">{plan.for}</p>
          <p className="font-display text-display-m tabular">
            {fill(plansCopy.perDay, { amount: formatRupees(plan.perDay) })}
          </p>
          <p className="text-small text-ink-soft tabular">
            {fill(plansCopy.perMonth, { amount: formatRupees(plan.perMonth) })}
          </p>
        </li>
      ))}
    </ul>
  )
}
