"use client"

import React from "react"
import { Banknote, ChevronRight, ChevronsRight, Loader2, Smartphone } from "lucide-react"
import { PaymentMethodId, PaymentState } from "../../types/payment"
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
  onChangeMethod?: () => void
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
  onChangeMethod,
}: ReviewOrderFooterProps) {
  const isLoading = isValidating || isSubmitting
  const formattedAmount = formatCurrency(totalAmount, { currency })

  const getActionTitle = () => {
    if (isLoading) {
      if (isValidating) return "Checking..."
      if (paymentState === "INITIATING") return "Connecting..."
      if (paymentState === "VERIFICATION_PENDING") return "Verifying..."
      if (paymentState === "CASH_PENDING") return "Confirming..."
      return "Processing..."
    }

    if (paymentState === "SUCCESS") {
      return "Order Placed"
    }

    return "Place order"
  }

  const renderMethodIcon = () => {
    if (selectedMethod === "CASH") {
      return (
        <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl border border-graphite/20 bg-graphite/5">
          <Banknote className="size-5 stroke-[2.2] text-macaw-blue" />
        </div>
      )
    }

    return (
      <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl border border-graphite/20 bg-paper">
        <Smartphone className="size-4.5 stroke-[2.2] text-ecto-green" />
      </div>
    )
  }

  const methodLabel = selectedMethod === "ONLINE" ? "UPI / Online" : "Cash at Shop"

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-graphite/20 bg-paper/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xs transition-all sm:static sm:border-2 sm:border-graphite/20 sm:bg-paper sm:p-4 sm:rounded-xl">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 sm:max-w-none">
        {/* Left Section: Change Method Button */}
        <button
          type="button"
          disabled={isLoading}
          onClick={onChangeMethod}
          aria-label={`Current payment method: ${methodLabel}. Click to change.`}
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-graphite/20 bg-paper p-2 sm:p-2.5 text-left transition-all hover:border-graphite/40 hover:bg-graphite/5 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 cursor-pointer select-none"
        >
          {renderMethodIcon()}

          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-extrabold tracking-wider uppercase text-emerald-800 transition-colors group-hover:text-emerald-900">
              CHANGE METHOD
              <ChevronRight className="size-3 stroke-[3]" />
            </span>
            <span className="block truncate text-[13px] sm:text-[14px] font-bold text-midnight leading-tight mt-0.5">
              {methodLabel}
            </span>
          </div>
        </button>

        {/* Right Section: Place order CTA button */}
        <button
          type="button"
          disabled={!canContinue || isLoading}
          onClick={onContinue}
          aria-label={`${getActionTitle()} for ${formattedAmount}`}
          className="flex min-w-[150px] sm:min-w-[180px] shrink-0 items-center justify-between gap-3 rounded-xl bg-ecto-green px-4 sm:px-5 py-2.5 sm:py-3 text-midnight transition-all hover:bg-ecto-green/90 active:scale-98 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ecto-green focus-visible:outline-hidden cursor-pointer select-none"
        >
          <div className="text-left min-w-0">
            <span className="block text-[12px] sm:text-[13px] font-extrabold leading-tight text-midnight">
              {getActionTitle()}
            </span>
            <span className="block text-[15px] sm:text-[17px] font-black leading-tight text-midnight tracking-tight">
              {formattedAmount}
            </span>
          </div>

          <div className="flex items-center justify-center pl-1">
            {isLoading ? (
              <Loader2 className="size-5.5 animate-spin text-midnight stroke-[2.5]" />
            ) : (
              <ChevronsRight className="size-5.5 text-midnight stroke-[2.5]" />
            )}
          </div>
        </button>
      </div>
    </div>
  )
}


