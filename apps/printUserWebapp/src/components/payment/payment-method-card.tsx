"use client"

import React from "react"
import { Check, CreditCard, Banknote, Smartphone } from "lucide-react"
import { PaymentMethodItem } from "../../types/payment"

interface PaymentMethodCardProps {
  method: PaymentMethodItem
  isSelected: boolean
  onSelect: () => void
  disabled?: boolean
}

export function PaymentMethodCard({
  method,
  isSelected,
  onSelect,
  disabled = false,
}: PaymentMethodCardProps) {
  const isCardDisabled = disabled || !method.enabled

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCardDisabled) return
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      onSelect()
    }
  }

  const renderIcon = () => {
    switch (method.iconName) {
      case "upi":
        return <Smartphone className="size-6 stroke-[2.2] text-ecto-green" />
      case "cash":
        return <Banknote className="size-6 stroke-[2.2] text-macaw-blue" />
      case "card":
      default:
        return <CreditCard className="size-6 stroke-[2.2] text-ash" />
    }
  }

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      aria-disabled={isCardDisabled}
      tabIndex={isCardDisabled ? -1 : 0}
      onClick={() => {
        if (!isCardDisabled) {
          onSelect()
        }
      }}
      onKeyDown={handleKeyDown}
      className={`group relative flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all select-none sm:gap-4 sm:p-5 ${
        isCardDisabled
          ? "cursor-not-allowed border-graphite/10 bg-graphite/5 opacity-60"
          : isSelected
            ? "border-ecto-green bg-eel-light/10 ring-2 ring-ecto-green/20"
            : "border-graphite/20 bg-paper hover:border-graphite/40 hover:bg-graphite/5"
      }`}
    >
      {/* Method Icon container */}
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg border-2 transition-colors sm:size-12 sm:rounded-xl ${
          isSelected
            ? "border-ecto-green/40 bg-eel-light/40"
            : "border-graphite/20 bg-paper"
        }`}
      >
        {renderIcon()}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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

        <p className="text-[11px] leading-snug text-ash sm:text-caption sm:leading-relaxed">
          {method.description}
        </p>

        {isCardDisabled && method.disabledReason && (
          <p className="text-[11px] font-bold text-destructive sm:text-caption">
            {method.disabledReason}
          </p>
        )}
      </div>

      {/* Radio Circle Indicator */}
      <div
        className={`mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:size-6 ${
          isSelected
            ? "border-ecto-green bg-ecto-green text-paper"
            : "border-graphite/30 bg-paper group-hover:border-graphite"
        }`}
      >
        {isSelected && <Check className="size-3 stroke-[3] sm:size-3.5" />}
      </div>
    </div>
  )
}
