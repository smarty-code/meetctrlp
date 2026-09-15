"use client"

import React from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { REVIEW_COPY } from "../../data/review-constants"

interface ReviewOrderFooterProps {
  totalAmount?: number
  totalDocuments?: number
  totalCopies?: number
  isValidating: boolean
  isSubmitting: boolean
  canContinue: boolean
  onContinue: () => void
}

export function ReviewOrderFooter({
  isValidating,
  isSubmitting,
  canContinue,
  onContinue,
}: ReviewOrderFooterProps) {
  const isLoading = isValidating || isSubmitting

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-graphite/20 bg-paper/95 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] backdrop-blur-xs transition-all sm:static sm:border-0 sm:bg-transparent sm:p-0">
      <div className="mx-auto w-full max-w-md sm:max-w-none">
        {/* Full-Width Prominent Primary CTA Button */}
        <button
          type="button"
          disabled={!canContinue || isLoading}
          onClick={onContinue}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ecto-green px-6 py-4 text-[16px] font-extrabold text-midnight transition-all hover:bg-ecto-green/90 active:scale-98 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ecto-green focus-visible:outline-hidden cursor-pointer"
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
