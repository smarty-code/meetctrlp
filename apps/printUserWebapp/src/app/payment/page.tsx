"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, CreditCard } from "lucide-react"
import { OrderDraft } from "../../types/order"
import { loadOrderDraft } from "../../data/order-repository"
import { formatCurrency } from "../../lib/currency"
import { REVIEW_ROUTES } from "../../data/review-constants"

export default function PaymentStubPage() {
  const router = useRouter()
  const [draft, setDraft] = useState<OrderDraft | null>(null)

  useEffect(() => {
    loadOrderDraft().then(setDraft)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-paper text-charcoal">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b-2 border-graphite/20 bg-paper/95 px-4 backdrop-blur-xs sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(REVIEW_ROUTES.REVIEW)}
            aria-label="Back to order review"
            className="flex size-10 items-center justify-center rounded-xl border-2 border-graphite/30 bg-paper text-midnight transition-colors hover:border-graphite hover:bg-eel-light/30 focus-visible:ring-2 focus-visible:ring-macaw-blue focus-visible:outline-hidden"
          >
            <ArrowLeft className="size-5 stroke-[2.5]" />
          </button>
          <h1 className="text-heading-sm font-bold tracking-heading-sm text-midnight">
            Payment
          </h1>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-ecto-green/50 bg-eel-light text-midnight">
          <CreditCard className="size-8 stroke-[2.5]" />
        </div>

        <span className="mt-4 rounded-full bg-eel-light px-3 py-1 text-caption font-bold text-midnight">
          Screen 04 — Payment
        </span>

        <h2 className="mt-3 text-heading-sm font-bold text-midnight">
          Order Ready for Payment
        </h2>

        {draft && (
          <div className="mt-6 w-full rounded-xl border-2 border-graphite/20 bg-paper p-5 text-left space-y-2">
            <div className="flex justify-between text-caption text-ash">
              <span>Order ID:</span>
              <span className="font-mono font-bold text-midnight">
                {draft.orderId}
              </span>
            </div>
            <div className="flex justify-between text-caption text-ash">
              <span>Shop:</span>
              <span className="font-bold text-midnight">{draft.shop.name}</span>
            </div>
            <div className="flex justify-between text-caption text-ash">
              <span>Documents:</span>
              <span className="font-bold text-midnight">
                {draft.documents.length}
              </span>
            </div>
            <div className="border-t border-graphite/10 pt-2 flex justify-between text-body font-bold text-midnight">
              <span>Amount Due:</span>
              <span>{formatCurrency(draft.pricing.total)}</span>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 text-caption text-charcoal">
          <CheckCircle2 className="size-4 text-ecto-green" />
          <span>Screen 03 transitioned successfully to Screen 04</span>
        </div>
      </main>
    </div>
  )
}
