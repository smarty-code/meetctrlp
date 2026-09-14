"use client"

import React from "react"
import { Building2, FileText, Hash } from "lucide-react"
import { ShopContext } from "../../types/upload"
import { formatCurrency } from "../../lib/currency"
import { PAYMENT_COPY } from "../../data/payment-constants"

interface PaymentOrderSummaryProps {
  orderId: string
  shop: ShopContext
  totalAmount: number
  totalDocuments: number
  totalCopies: number
  currency?: string
}

export function PaymentOrderSummary({
  orderId,
  shop,
  totalAmount,
  totalDocuments,
  totalCopies,
  currency = "INR",
}: PaymentOrderSummaryProps) {
  const formattedAmount = formatCurrency(totalAmount, { currency })

  return (
    <section
      aria-labelledby="payment-order-summary-heading"
      className="overflow-hidden rounded-xl border-2 border-graphite/20 bg-paper transition-shadow"
    >
      {/* Header bar of summary */}
      <div className="flex items-center justify-between border-b border-graphite/10 bg-graphite/5 px-4 py-3 sm:px-5">
        <span
          id="payment-order-summary-heading"
          className="text-caption font-bold tracking-wider text-ash uppercase"
        >
          {PAYMENT_COPY.orderSummaryTitle}
        </span>
        <div className="flex items-center gap-1.5 font-mono text-caption font-bold text-midnight">
          <Hash className="size-3.5 text-ash" />
          <span>{orderId}</span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Shop Info & Document meta */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-graphite/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-body font-bold text-midnight">
              <Building2 className="size-4 text-ecto-green" />
              <span>{shop.name}</span>
            </div>
            {shop.address && (
              <p className="text-caption text-ash line-clamp-1">
                {shop.address}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-graphite/20 bg-graphite/5 px-3 py-1 text-caption font-bold text-charcoal">
            <FileText className="size-3.5 text-macaw-blue" />
            <span>
              {totalDocuments} {totalDocuments === 1 ? "document" : "documents"} ·{" "}
              {totalCopies} {totalCopies === 1 ? "copy" : "copies"}
            </span>
          </div>
        </div>

        {/* Amount to Pay — Prominent display per specification */}
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-body font-bold text-midnight">
            {PAYMENT_COPY.amountToPayLabel}
          </span>
          <div className="text-right">
            <span className="text-heading font-bold text-midnight tracking-tight">
              {formattedAmount}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
