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
        return <Smartphone className="size-4.5 stroke-[2.2] text-ecto-green" />
      case "cash":
        return <Banknote className="size-4.5 stroke-[2.2] text-macaw-blue" />
      case "card":
      default:
        return <CreditCard className="size-4.5 stroke-[2.2] text-ash" />
    }
  }

  const title = method.id === "ONLINE" ? "UPI / Online" : "Cash at Shop"
  const subtitle =
    isCardDisabled && method.disabledReason
      ? method.disabledReason
      : method.id === "ONLINE"
        ? "Instant Confirmation"
        : "Pay at Counter"

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
      className={`group relative flex flex-col justify-between cursor-pointer rounded-xl border-2 p-2.5 sm:p-3 transition-all select-none ${
        isCardDisabled
          ? "cursor-not-allowed border-graphite/10 bg-graphite/5 opacity-60"
          : isSelected
            ? "border-ecto-green bg-eel-light/15 ring-2 ring-ecto-green/20"
            : "border-graphite/20 bg-paper hover:border-graphite/40 hover:bg-graphite/5"
      }`}
    >
      {/* Top row: Icon + Radio Indicator */}
      <div className="flex items-center justify-between">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            isSelected
              ? "border-ecto-green/40 bg-eel-light/40"
              : "border-graphite/20 bg-paper"
          }`}
        >
          {renderIcon()}
        </div>

        <div
          className={`flex size-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            isSelected
              ? "border-ecto-green bg-ecto-green text-paper"
              : "border-graphite/30 bg-paper group-hover:border-graphite"
          }`}
        >
          {isSelected && <Check className="size-2.5 stroke-[3]" />}
        </div>
      </div>

      {/* Bottom text: Simple title & short subtitle */}
      <div className="mt-2 sm:mt-2.5">
        <span className="block text-[13px] sm:text-[14px] font-bold text-midnight leading-tight">
          {title}
        </span>
        <span className="block text-[11px] text-ash leading-tight mt-0.5 truncate">
          {subtitle}
        </span>
      </div>
    </div>
  )
}

