"use client"

import React, { useEffect } from "react"
import { Check, CreditCard, Banknote, Smartphone, X } from "lucide-react"
import { PaymentMethodId, PaymentMethodItem } from "../../types/payment"
import { PAYMENT_COPY } from "../../data/payment-constants"

interface PaymentMethodDrawerProps {
  isOpen: boolean
  onClose: () => void
  methods: PaymentMethodItem[]
  selectedMethod: PaymentMethodId
  onSelectMethod: (id: PaymentMethodId) => void
  disabled?: boolean
}

export function PaymentMethodDrawer({
  isOpen,
  onClose,
  methods,
  selectedMethod,
  onSelectMethod,
  disabled = false,
}: PaymentMethodDrawerProps) {
  // ESC key dismiss
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  if (!isOpen) return null

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "upi":
        return <Smartphone className="size-5 stroke-[2.2] text-ecto-green" />
      case "cash":
        return <Banknote className="size-5 stroke-[2.2] text-macaw-blue" />
      case "card":
      default:
        return <CreditCard className="size-5 stroke-[2.2] text-ash" />
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-drawer-title"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-midnight/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer / Modal Surface */}
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl border-t-2 border-x-2 border-graphite/20 bg-paper p-5 sm:rounded-2xl sm:border-2 sm:p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-graphite/10 pb-4">
          <h2
            id="payment-drawer-title"
            className="text-body font-bold text-midnight sm:text-[17px]"
          >
            {PAYMENT_COPY.choosePaymentTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg border border-graphite/20 text-ash hover:text-midnight hover:bg-graphite/5 transition-colors cursor-pointer"
          >
            <X className="size-4.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Methods list */}
        <div
          role="radiogroup"
          aria-labelledby="payment-drawer-title"
          className="space-y-3 pt-4"
        >
          {methods.map((method) => {
            const isSelected = selectedMethod === method.id
            const isCardDisabled = disabled || !method.enabled

            return (
              <div
                key={method.id}
                role="radio"
                aria-checked={isSelected}
                aria-disabled={isCardDisabled}
                tabIndex={isCardDisabled ? -1 : 0}
                onClick={() => {
                  if (!isCardDisabled) {
                    onSelectMethod(method.id)
                    onClose()
                  }
                }}
                onKeyDown={(e) => {
                  if (isCardDisabled) return
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault()
                    onSelectMethod(method.id)
                    onClose()
                  }
                }}
                className={`group relative flex cursor-pointer items-start gap-3.5 rounded-xl border-2 p-3.5 sm:p-4 transition-all select-none ${
                  isCardDisabled
                    ? "cursor-not-allowed border-graphite/10 bg-graphite/5 opacity-60"
                    : isSelected
                      ? "border-ecto-green bg-eel-light/15 ring-2 ring-ecto-green/20"
                      : "border-graphite/20 bg-paper hover:border-graphite/40 hover:bg-graphite/5"
                }`}
              >
                {/* Method Icon container */}
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    isSelected
                      ? "border-ecto-green/40 bg-eel-light/40"
                      : "border-graphite/20 bg-paper"
                  }`}
                >
                  {renderIcon(method.iconName)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold text-midnight sm:text-body">
                      {method.title}
                    </span>
                    {method.badgeText && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold sm:text-[11px] ${
                          isSelected
                            ? "bg-eel-light text-midnight"
                            : "bg-graphite/10 text-charcoal"
                        }`}
                      >
                        {method.badgeText}
                      </span>
                    )}
                  </div>

                  <p className="text-[12px] leading-relaxed text-ash">
                    {method.description}
                  </p>

                  {isCardDisabled && method.disabledReason && (
                    <p className="text-[11px] font-bold text-destructive">
                      {method.disabledReason}
                    </p>
                  )}
                </div>

                {/* Radio Circle Indicator */}
                <div
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected
                      ? "border-ecto-green bg-ecto-green text-paper"
                      : "border-graphite/30 bg-paper group-hover:border-graphite"
                  }`}
                >
                  {isSelected && <Check className="size-3 stroke-[3]" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
