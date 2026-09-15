"use client"

import React from "react"
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react"
import { PAYMENT_COPY } from "../../data/payment-constants"

interface PaymentErrorStateProps {
  isEmpty?: boolean
  onRetry?: () => void
  onReturnHome?: () => void
  onBackToReview?: () => void
}

export function PaymentErrorState({
  isEmpty = false,
  onRetry,
  onReturnHome,
  onBackToReview,
}: PaymentErrorStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border-2 border-destructive/40 bg-destructive/10 text-destructive">
        <AlertCircle className="size-7 stroke-[2.2]" />
      </div>

      <h2 className="mt-4 text-heading-sm font-bold text-midnight">
        {isEmpty ? PAYMENT_COPY.errorEmptyOrder : PAYMENT_COPY.errorLoadingOrder}
      </h2>

      <p className="mt-2 text-caption text-ash leading-relaxed">
        {isEmpty
          ? "We could not find an active print order ready for payment. Please return and select your documents."
          : "We encountered an issue connecting to your order details. Your uploaded files and configurations are safe."}
      </p>

      <div className="mt-6 flex flex-col w-full gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-b-4 border-emerald-700 bg-ecto-green font-bold text-midnight hover:brightness-105 active:border-b-0 active:translate-y-1"
          >
            <RefreshCw className="size-4 stroke-[2.5]" />
            <span>{PAYMENT_COPY.retryCTA}</span>
          </button>
        )}

        {onBackToReview && (
          <button
            type="button"
            onClick={onBackToReview}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-graphite/30 bg-paper font-bold text-midnight hover:bg-graphite/5"
          >
            <ArrowLeft className="size-4 stroke-[2.5]" />
            <span>Back to Review</span>
          </button>
        )}

        {onReturnHome && (
          <button
            type="button"
            onClick={onReturnHome}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-graphite/20 bg-paper font-bold text-ash hover:border-graphite/40 hover:text-midnight"
          >
            <span>{PAYMENT_COPY.returnToUploadCTA}</span>
          </button>
        )}
      </div>
    </div>
  )
}
