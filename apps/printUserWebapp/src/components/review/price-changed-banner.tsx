"use client"

import React from "react"
import { AlertCircle, X } from "lucide-react"
import { formatCurrency } from "../../lib/currency"
import { REVIEW_COPY } from "../../data/review-constants"

interface PriceChangedBannerProps {
  previousTotal: number
  newTotal: number
  onDismiss: () => void
}

export function PriceChangedBanner({
  previousTotal,
  newTotal,
  onDismiss,
}: PriceChangedBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-xl border-2 border-macaw-blue bg-macaw-blue/10 p-4 text-midnight animate-fadeIn"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-macaw-blue" />
        <div>
          <h3 className="text-body font-bold">{REVIEW_COPY.priceChangedTitle}</h3>
          <p className="mt-0.5 text-caption text-charcoal">
            {REVIEW_COPY.priceChangedMessage}
          </p>
          <div className="mt-2 flex items-center gap-2 text-caption font-bold">
            <span className="line-through text-ash">
              {formatCurrency(previousTotal)}
            </span>
            <span className="text-midnight font-bold">
              → {formatCurrency(newTotal)}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss price update alert"
        className="rounded-lg p-1 text-charcoal transition-colors hover:bg-graphite/10 focus-visible:outline-hidden"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
