"use client"

import React from "react"
import { Building2, FileText, Hash, MapPin } from "lucide-react"
import { ShopContext } from "../../types/upload"
import { PAYMENT_COPY } from "../../data/payment-constants"

interface PaymentOrderSummaryProps {
  orderId: string
  shop: ShopContext
  totalAmount?: number
  totalDocuments: number
  totalCopies: number
  currency?: string
}

export function PaymentOrderSummary({
  orderId,
  shop,
  totalDocuments,
  totalCopies,
}: PaymentOrderSummaryProps) {
  return (
    <section
      aria-labelledby="payment-order-summary-heading"
      className="overflow-hidden rounded-xl border-2 border-graphite/20 bg-paper transition-shadow"
    >
      {/* Header bar of summary */}
      <div className="flex items-center justify-between border-b border-graphite/10 bg-graphite/5 px-3.5 py-2 sm:px-5 sm:py-2.5">
        <span
          id="payment-order-summary-heading"
          className="text-[11px] font-bold tracking-wider text-ash uppercase sm:text-caption"
        >
          {PAYMENT_COPY.orderSummaryTitle}
        </span>
        <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-midnight sm:text-caption">
          <Hash className="size-3 text-ash sm:size-3.5" />
          <span>{orderId}</span>
        </div>
      </div>

      <div className="p-3.5 sm:p-4">
        {/* Shop Info & Document meta */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 text-[15px] font-bold text-midnight sm:text-body">
              <Building2 className="size-4 shrink-0 text-ecto-green" />
              <span>{shop.name}</span>
            </div>
            {shop.address && (
              <div className="flex items-start gap-1 text-[12px] text-ash sm:text-caption leading-snug">
                <MapPin className="size-3.5 shrink-0 text-ash/80 mt-0.5" />
                <span>{shop.address}</span>
              </div>
            )}
          </div>

          <div className="self-start flex shrink-0 items-center gap-1.5 rounded-full border border-graphite/20 bg-graphite/5 px-2.5 py-1 text-[11px] font-bold text-charcoal sm:px-3 sm:text-caption">
            <FileText className="size-3.5 text-macaw-blue" />
            <span>
              {totalDocuments} {totalDocuments === 1 ? "document" : "documents"} ·{" "}
              {totalCopies} {totalCopies === 1 ? "copy" : "copies"}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
