"use client"

import React from "react"
import { ArrowRight, Loader2, Lock } from "lucide-react"
import { PaymentMethodId, PaymentState } from "../../types/payment"
import { PAYMENT_COPY } from "../../data/payment-constants"
import { formatCurrency } from "../../lib/currency"

interface ReviewOrderFooterProps {
  totalAmount: number
  currency?: string
  totalDocuments?: number
  totalCopies?: number
  selectedMethod?: PaymentMethodId
  paymentState?: PaymentState
  isValidating?: boolean
  isSubmitting: boolean
  canContinue: boolean
  onContinue: () => void
}

export function ReviewOrderFooter({
  totalAmount,
  currency = "INR",
  selectedMethod = "ONLINE",
  paymentState = "NOT_STARTED",
  isValidating = false,
  isSubmitting,
  canContinue,
  onContinue,
}: ReviewOrderFooterProps) {
  const isLoading = isValidating || isSubmitting
  const formattedAmount = formatCurrency(totalAmount, { currency })

  const getButtonLabel = () => {
    if (isLoading) {
      if (isValidating) return "Checking price..."
      if (paymentState === "INITIATING") return PAYMENT_COPY.startingPaymentCTA
      if (paymentState === "VERIFICATION_PENDING")
        return PAYMENT_COPY.verifyingPaymentCTA
      if (paymentState === "CASH_PENDING") return PAYMENT_COPY.confirmingOrderCTA
      return "Processing..."
    }

    if (paymentState === "SUCCESS") {
      return "Order Placed"
    }

    if (selectedMethod === "ONLINE") {
      return `${PAYMENT_COPY.onlineCTAPrefix} ${formattedAmount}`
    }

    return "Confirm Order • Pay at Shop"
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-graphite/20 bg-paper/95 p-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] backdrop-blur-xs transition-all sm:static sm:border-0 sm:bg-transparent sm:p-0">
      <div className="mx-auto w-full max-w-md sm:max-w-none space-y-2">
        {/* Helper text with security / payment condition */}
        <div className="flex items-center justify-between text-caption text-ash px-0.5">
          <div className="flex items-center gap-1.5">
            <Lock className="size-3.5 text-ecto-green shrink-0" />
            <span>
              {selectedMethod === "ONLINE"
                ? "256-bit encrypted checkout"
                : PAYMENT_COPY.amountDueAtShop(formattedAmount)}
            </span>
          </div>
          <span className="font-bold text-midnight">{formattedAmount}</span>
        </div>

        {/* Full-Width Prominent Primary CTA Button */}
        <button
          type="button"
          disabled={!canContinue || isLoading}
          onClick={onContinue}
          aria-label={getButtonLabel()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ecto-green px-6 py-4 text-[16px] font-extrabold text-midnight transition-all hover:bg-ecto-green/90 active:scale-98 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ecto-green focus-visible:outline-hidden cursor-pointer select-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-5 animate-spin stroke-[2.5]" />
              <span>{getButtonLabel()}</span>
            </>
          ) : (
            <>
              <span>{getButtonLabel()}</span>
              <ArrowRight className="size-5 stroke-[2.5]" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

