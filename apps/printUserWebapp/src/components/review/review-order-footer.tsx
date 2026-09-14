"use client"

import React from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { formatCurrency } from "../../lib/currency"
import { REVIEW_COPY } from "../../data/review-constants"

interface ReviewOrderFooterProps {
  totalAmount: number
  totalDocuments: number
  totalCopies: number
  isValidating: boolean
  isSubmitting: boolean
  canContinue: boolean
  onContinue: () => void
}

export function ReviewOrderFooter({
  totalAmount,
  totalDocuments,
  totalCopies,
  isValidating,
  isSubmitting,
  canContinue,
  onContinue,
}: ReviewOrderFooterProps) {
  const isLoading = isValidating || isSubmitting

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-graphite/20 bg-paper/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-xs transition-all sm:static sm:border-0 sm:bg-transparent sm:p-0">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-4 sm:max-w-none sm:flex-col sm:items-stretch">
        {/* Mobile Left / Mini Price Peek */}
        <div className="flex flex-col sm:hidden">
          <span className="text-caption text-ash">
            {totalDocuments} {totalDocuments === 1 ? "doc" : "docs"} · {totalCopies}{" "}
            {totalCopies === 1 ? "copy" : "copies"}
          </span>
          <span className="text-body font-bold text-midnight">
            {formatCurrency(totalAmount)}
          </span>
        </div>

        {/* Primary CTA Button */}
        <button
          type="button"
          disabled={!canContinue || isLoading}
          onClick={onContinue}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ecto-green px-6 py-4 text-body font-bold text-midnight transition-all hover:bg-ecto-green/90 active:scale-98 disabled:pointer-events-none disabled:opacity-50 sm:w-full focus-visible:ring-2 focus-visible:ring-macaw-blue focus-visible:outline-hidden"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span>{REVIEW_COPY.checkingPriceCTA}</span>
            </>
          ) : (
            <>
              <span>{REVIEW_COPY.continueCTA}</span>
              <ArrowRight className="size-5 stroke-[2.5]" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
