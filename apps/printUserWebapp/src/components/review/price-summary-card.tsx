"use client"

import React from "react"
import { OrderPricingBreakdown } from "../../types/order"
import { formatCurrency } from "../../lib/currency"
import { REVIEW_COPY } from "../../data/review-constants"

interface PriceSummaryCardProps {
  pricing: OrderPricingBreakdown
}

export function PriceSummaryCard({ pricing }: PriceSummaryCardProps) {
  const { printCharges, fees, taxes, discounts, total } = pricing

  return (
    <section
      aria-labelledby="price-summary-heading"
      className="rounded-xl border-2 border-graphite/20 bg-paper p-4 transition-colors sm:p-5"
    >
      <h2
        id="price-summary-heading"
        className="text-body font-bold text-midnight"
      >
        {REVIEW_COPY.priceSummaryTitle}
      </h2>

      <div className="mt-4 space-y-2.5 text-body text-charcoal">
        {/* Base Print Charges */}
        <div className="flex items-center justify-between">
          <span>{REVIEW_COPY.printChargesLabel}</span>
          <span className="font-medium text-midnight">
            {formatCurrency(printCharges)}
          </span>
        </div>

        {/* Dynamic Fees (only shown if configured and > 0) */}
        {fees.map((fee) => (
          <div key={fee.id} className="flex items-center justify-between">
            <span>{fee.label}</span>
            <span className="font-medium text-midnight">
              {formatCurrency(fee.amount)}
            </span>
          </div>
        ))}

        {/* Dynamic Taxes (only shown if configured and > 0) */}
        {taxes.map((tax) => (
          <div key={tax.id} className="flex items-center justify-between">
            <span>{tax.label}</span>
            <span className="font-medium text-midnight">
              {formatCurrency(tax.amount)}
            </span>
          </div>
        ))}

        {/* Dynamic Discounts (only shown if configured and > 0) */}
        {discounts.map((discount) => (
          <div
            key={discount.id}
            className="flex items-center justify-between text-ecto-green"
          >
            <span>{discount.label}</span>
            <span className="font-bold">-{formatCurrency(discount.amount)}</span>
          </div>
        ))}

        {/* Clear Visual Divider */}
        <div className="border-t-2 border-dashed border-graphite/20 pt-3">
          {/* Final Authoritative Total with Strong Hierarchy */}
          <div className="flex items-baseline justify-between">
            <span className="text-body font-bold text-midnight">
              {REVIEW_COPY.totalPayableLabel}
            </span>
            <span className="text-heading-sm font-bold text-midnight">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
