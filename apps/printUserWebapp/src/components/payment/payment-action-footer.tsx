"use client"

import React from "react"
import { ArrowRight, Loader2, Lock } from "lucide-react"
import { PaymentMethodId, PaymentState } from "../../types/payment"
import { PAYMENT_COPY } from "../../data/payment-constants"
import { formatCurrency } from "../../lib/currency"

interface PaymentActionFooterProps {
  totalAmount: number
  currency?: string
  selectedMethod: PaymentMethodId
  paymentState: PaymentState
  isSubmitting: boolean
  canSubmit: boolean
  onSubmit: () => void
}

export function PaymentActionFooter({
  totalAmount,
  currency = "INR",
  selectedMethod,
  paymentState,
  isSubmitting,
  canSubmit,
  onSubmit,
}: PaymentActionFooterProps) {
  const formattedAmount = formatCurrency(totalAmount, { currency })

  // Determine button label based on state and method
  const getButtonLabel = () => {
    if (isSubmitting) {
      if (paymentState === "INITIATING") return PAYMENT_COPY.startingPaymentCTA
      if (paymentState === "VERIFICATION_PENDING")
        return PAYMENT_COPY.verifyingPaymentCTA
      if (paymentState === "CASH_PENDING") return PAYMENT_COPY.confirmingOrderCTA
      return "Processing..."
    }

    if (paymentState === "SUCCESS") {
      return "Payment Successful"
    }

    if (selectedMethod === "ONLINE") {
      return `${PAYMENT_COPY.onlineCTAPrefix} ${formattedAmount}`
    }

    return PAYMENT_COPY.cashCTA
  }

  const isActionDisabled = !canSubmit || isSubmitting

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 w-full border-t border-graphite/20 bg-paper/95 px-4 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)] sm:static sm:z-auto sm:border-2 sm:p-5 sm:rounded-xl sm:shadow-none">
      <div className="mx-auto flex max-w-lg flex-col gap-2 sm:gap-3">
        {/* Method explanation / summary helper */}
        <div className="flex items-center justify-between text-[11px] sm:text-caption text-ash">
          <div className="flex items-center gap-1.5">
            <Lock className="size-3 sm:size-3.5 text-ecto-green" />
            <span>
              {selectedMethod === "ONLINE"
                ? "256-bit encrypted checkout"
                : PAYMENT_COPY.amountDueAtShop(formattedAmount)}
            </span>
          </div>
          <span className="font-bold text-midnight sm:text-[13px]">{formattedAmount}</span>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          disabled={isActionDisabled}
          onClick={onSubmit}
          aria-label={getButtonLabel()}
          className={`relative flex h-12 sm:h-14 w-full items-center justify-center gap-2 rounded-xl border-b-4 font-bold text-[15px] sm:text-body transition-all select-none focus-visible:ring-2 focus-visible:ring-macaw-blue focus-visible:outline-hidden active:scale-[0.99] ${
            isActionDisabled
              ? "cursor-not-allowed border-graphite/30 bg-graphite/20 text-graphite/60 opacity-60"
              : "border-emerald-700 bg-ecto-green text-midnight hover:brightness-105 active:border-b-0 active:translate-y-1"
          }`}
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <Loader2 className="size-4.5 sm:size-5 animate-spin text-midnight stroke-[2.5]" />
              <span>{getButtonLabel()}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>{getButtonLabel()}</span>
              <ArrowRight className="size-4.5 sm:size-5 stroke-[2.5]" />
            </div>
          )}
        </button>
      </div>
    </div>
  )
}
