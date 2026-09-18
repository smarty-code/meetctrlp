"use client"

import React from "react"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { PaymentState } from "../../types/payment"
import { PAYMENT_COPY } from "../../data/payment-constants"
import { formatCurrency } from "../../lib/currency"

interface PaymentStatusFeedbackProps {
  paymentState: PaymentState
  errorMessage?: string | null
  priceNotice?: {
    previousTotal: number
    newTotal: number
  } | null
  onRetry?: () => void
  onDismissPriceNotice?: () => void
}

export function PaymentStatusFeedback({
  paymentState,
  errorMessage,
  priceNotice,
  onRetry,
  onDismissPriceNotice,
}: PaymentStatusFeedbackProps) {
  // 1. Price Changed Warning
  if (priceNotice) {
    return (
      <div
        role="alert"
        className="rounded-xl border-2 border-macaw-blue bg-macaw-blue/10 p-4 text-charcoal animate-fadeIn"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 text-macaw-blue mt-0.5" />
          <div className="flex-1 space-y-1">
            <h3 className="text-body font-bold text-midnight">
              {PAYMENT_COPY.priceChangedTitle}
            </h3>
            <p className="text-caption text-charcoal leading-relaxed">
              {PAYMENT_COPY.priceChangedDescription} (Was{" "}
              <span className="font-bold line-through text-ash">
                {formatCurrency(priceNotice.previousTotal)}
              </span>
              , now{" "}
              <span className="font-bold text-midnight">
                {formatCurrency(priceNotice.newTotal)}
              </span>
              )
            </p>
            {onDismissPriceNotice && (
              <button
                type="button"
                onClick={onDismissPriceNotice}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border-2 border-macaw-blue bg-paper px-3 py-1.5 text-caption font-bold text-macaw-blue hover:bg-macaw-blue/10 transition-colors"
              >
                <span>{PAYMENT_COPY.reviewPriceCTA}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 2. Failure State
  if (paymentState === "FAILED" || (errorMessage && paymentState !== "SUCCESS")) {
    return (
      <div
        role="alert"
        className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 text-charcoal animate-fadeIn"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 text-destructive mt-0.5" />
          <div className="flex-1 space-y-2">
            <h3 className="text-body font-bold text-destructive">
              {PAYMENT_COPY.paymentFailedTitle}
            </h3>
            <p className="text-caption text-charcoal leading-relaxed">
              {errorMessage || PAYMENT_COPY.paymentFailedDescription}
            </p>
            {onRetry && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-destructive bg-paper px-4 py-2 text-caption font-bold text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
                >
                  <RotateCcw className="size-4 stroke-[2.5]" />
                  <span>{PAYMENT_COPY.retryCTA}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 3. In-flight Processing States
  if (
    paymentState === "INITIATING" ||
    paymentState === "VERIFICATION_PENDING" ||
    paymentState === "CASH_PENDING"
  ) {
    const message =
      paymentState === "INITIATING"
        ? PAYMENT_COPY.startingPaymentCTA
        : paymentState === "VERIFICATION_PENDING"
          ? PAYMENT_COPY.verifyingPaymentCTA
          : PAYMENT_COPY.confirmingOrderCTA

    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-xl border-2 border-macaw-blue/40 bg-macaw-blue/10 p-4 text-midnight animate-fadeIn"
      >
        <Loader2 className="size-5 shrink-0 animate-spin text-macaw-blue stroke-[2.5]" />
        <div className="space-y-0.5">
          <p className="text-body font-bold text-midnight">{message}</p>
          <p className="text-caption text-ash">
            {paymentState === "VERIFICATION_PENDING"
              ? PAYMENT_COPY.paymentPendingDescription
              : "Please keep this page open while we finalize your order."}
          </p>
        </div>
      </div>
    )
  }

  // 4. Success state (brief transition notice)
  if (paymentState === "SUCCESS") {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-xl border-2 border-ecto-green bg-eel-light/50 p-4 text-midnight animate-fadeIn"
      >
        <CheckCircle2 className="size-5 shrink-0 text-ecto-green stroke-[2.5]" />
        <div>
          <p className="text-body font-bold text-midnight">
            {PAYMENT_COPY.paymentSuccessNotice}
          </p>
        </div>
      </div>
    )
  }

  return null
}
