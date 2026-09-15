"use client"

import React from "react"
import { PaymentMethodId, PaymentMethodItem } from "../../types/payment"
import { PaymentMethodCard } from "./payment-method-card"
import { PAYMENT_COPY } from "../../data/payment-constants"

interface PaymentMethodSelectorProps {
  methods: PaymentMethodItem[]
  selectedMethod: PaymentMethodId
  onSelectMethod: (id: PaymentMethodId) => void
  disabled?: boolean
}

export function PaymentMethodSelector({
  methods,
  selectedMethod,
  onSelectMethod,
  disabled = false,
}: PaymentMethodSelectorProps) {
  return (
    <section
      aria-labelledby="payment-methods-heading"
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <h2
          id="payment-methods-heading"
          className="text-caption font-bold tracking-wide uppercase text-ash"
        >
          {PAYMENT_COPY.choosePaymentTitle}
        </h2>
      </div>

      <div
        role="radiogroup"
        aria-labelledby="payment-methods-heading"
        className="grid grid-cols-2 gap-2.5 sm:gap-3"
      >
        {methods.map((method) => (
          <PaymentMethodCard
            key={method.id}
            method={method}
            isSelected={selectedMethod === method.id}
            onSelect={() => onSelectMethod(method.id)}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  )
}
