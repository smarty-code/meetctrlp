"use client"

import React from "react"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { PAYMENT_COPY } from "../../data/payment-constants"

interface PaymentHeaderProps {
  onBack: () => void
}

export function PaymentHeader({ onBack }: PaymentHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b-2 border-graphite/20 bg-paper/95 px-4 backdrop-blur-xs sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={PAYMENT_COPY.backButtonAria}
          className="flex size-10 items-center justify-center rounded-xl border-2 border-graphite/30 bg-paper text-midnight transition-colors hover:border-graphite hover:bg-eel-light/30 focus-visible:ring-2 focus-visible:ring-macaw-blue focus-visible:outline-hidden active:scale-95"
        >
          <ArrowLeft className="size-5 stroke-[2.5]" />
        </button>
        <div>
          <h1 className="text-heading-sm font-bold tracking-heading-sm text-midnight">
            {PAYMENT_COPY.headerTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1.5 rounded-full border border-graphite/20 bg-paper px-3 py-1 text-caption font-bold text-ash">
        <ShieldCheck className="size-4 text-ecto-green" />
        <span>Secure</span>
      </div>
    </header>
  )
}
