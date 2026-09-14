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
      className={`group relative flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all select-none sm:p-5 ${
        isCardDisabled
          ? "cursor-not-allowed border-graphite/10 bg-graphite/5 opacity-60"
          : isSelected
            ? "border-ecto-green bg-eel-light/10 ring-2 ring-ecto-green/20"
            : "border-graphite/20 bg-paper hover:border-graphite/40 hover:bg-graphite/5"
      }`}
    >
      {/* Method Icon container */}
      <div
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
          isSelected
            ? "border-ecto-green/40 bg-eel-light/40"
            : "border-graphite/20 bg-paper"
        }`}
      >
        {renderIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body font-bold text-midnight">
            {method.title}
          </span>
          {method.badgeText && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                isSelected
                  ? "bg-eel-light text-midnight"
                  : "bg-graphite/10 text-charcoal"
              }`}
            >
              {method.badgeText}
            </span>
          )}
        </div>

        <p className="text-caption text-ash leading-relaxed">
          {method.description}
        </p>

        {isCardDisabled && method.disabledReason && (
          <p className="text-caption font-bold text-destructive">
            {method.disabledReason}
          </p>
        )}
      </div>

      {/* Radio Circle Indicator */}
      <div
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isSelected
            ? "border-ecto-green bg-ecto-green text-paper"
            : "border-graphite/30 bg-paper group-hover:border-graphite"
        }`}
      >
        {isSelected && <Check className="size-3.5 stroke-[3]" />}
      </div>
    </div>
  )
}
