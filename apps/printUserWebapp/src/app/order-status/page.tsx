"use client"

import React, { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Building2,
  CheckCircle2,
  Clock,
  Hash,
  Home,
  Printer,
} from "lucide-react"
import { SubmittedOrder } from "../../types/payment"
import { getSubmittedOrder } from "../../data/payment-repository"
import { formatCurrency } from "../../lib/currency"
import { PAYMENT_ROUTES } from "../../data/payment-constants"

function OrderStatusContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderIdParam = searchParams.get("orderId")
  const [order] = useState<SubmittedOrder | null>(() => getSubmittedOrder())

  const displayOrderId = order?.orderId || orderIdParam || "ORD-RECENT"
  const isCash = order?.paymentMethod === "CASH"

  return (
    <div className="flex min-h-screen flex-col bg-paper text-charcoal">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b-2 border-graphite/20 bg-paper/95 px-4 backdrop-blur-xs sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border-2 border-ecto-green/50 bg-eel-light text-midnight">
            <CheckCircle2 className="size-6 text-ecto-green stroke-[2.5]" />
          </div>
          <div>
            <span className="text-caption font-bold text-ash">Screen 05</span>
            <h1 className="text-heading-sm font-bold tracking-heading-sm text-midnight">
              Order Status
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push(PAYMENT_ROUTES.HOME)}
          aria-label="Back to home"
          className="flex items-center gap-1.5 rounded-xl border-2 border-graphite/20 bg-paper px-3 py-1.5 text-caption font-bold text-charcoal hover:border-graphite/40 transition-colors"
        >
          <Home className="size-4" />
          <span className="hidden sm:inline">New Order</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6">
        <div className="space-y-6">
          {/* Order Placement Banner */}
          <div className="rounded-xl border-2 border-ecto-green/50 bg-eel-light/30 p-5 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-ecto-green text-paper">
              <CheckCircle2 className="size-7 stroke-[3]" />
            </div>
            <h2 className="mt-3 text-heading-sm font-bold text-midnight">
              Order Placed!
            </h2>
            <p className="mt-1 text-caption text-charcoal">
              Your order has been sent to the shop and is queued for printing.
            </p>

            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-graphite/20 bg-paper px-3 py-1 text-caption font-mono font-bold text-midnight">
              <Hash className="size-3.5 text-ash" />
              <span>{displayOrderId}</span>
            </div>
          </div>

          {/* Payment Details Card */}
          <div className="rounded-xl border-2 border-graphite/20 bg-paper p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-graphite/10 pb-3">
              <span className="text-caption font-bold text-ash uppercase tracking-wider">
                Payment Status
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-caption font-bold ${
                  isCash
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-eel-light text-midnight border border-ecto-green/40"
                }`}
              >
                {isCash ? "Payment Due at Shop" : "Paid Online"}
              </span>
            </div>

            <div className="flex items-center justify-between text-body">
              <span className="font-bold text-midnight">
                {isCash ? "Amount due at pickup:" : "Amount paid:"}
              </span>
              <span className="text-heading-sm font-bold text-midnight">
                {order?.totalAmount !== undefined
                  ? formatCurrency(order.totalAmount, {
                      currency: order.currency,
                    })
                  : "—"}
              </span>
            </div>

            {order?.shop && (
              <div className="pt-2 border-t border-graphite/10 flex items-center justify-between text-caption text-ash">
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-ecto-green" />
                  <span className="font-bold text-charcoal">
                    {order.shop.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  <span>~{order.shop.estimatedMinutes || 10} mins</span>
                </div>
              </div>
            )}
          </div>

          {/* Progress Timeline (per Screen 05 State A spec) */}
          <section
            aria-labelledby="timeline-heading"
            className="rounded-xl border-2 border-graphite/20 bg-paper p-5"
          >
            <h3
              id="timeline-heading"
              className="text-body font-bold text-midnight mb-4"
            >
              Order Timeline
            </h3>

            <div className="space-y-4">
              {/* Step 1: Order Placed (Completed) */}
              <div className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ecto-green text-paper">
                  <CheckCircle2 className="size-4 stroke-[3]" />
                </div>
                <div className="flex-1">
                  <p className="text-body font-bold text-midnight">
                    Order Placed
                  </p>
                  <p className="text-caption text-ash">
                    Received by {order?.shop?.name || "the shop"}
                  </p>
                </div>
              </div>

              {/* Step 2: Printing (Pending) */}
              <div className="flex items-start gap-3 opacity-60">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-graphite/30 bg-graphite/5 text-ash">
                  <Printer className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="text-body font-bold text-midnight">Printing</p>
                  <p className="text-caption text-ash">
                    Documents are queued for print
                  </p>
                </div>
              </div>

              {/* Step 3: Ready for Pickup (Pending) */}
              <div className="flex items-start gap-3 opacity-60">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-graphite/30 bg-graphite/5 text-ash">
                  <Clock className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="text-body font-bold text-midnight">
                    Ready for Pickup
                  </p>
                  <p className="text-caption text-ash">
                    Shop will notify when ready at counter
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Help & Counter Tip */}
          <div className="rounded-xl border-2 border-graphite/10 bg-graphite/5 p-4 text-center">
            <p className="text-caption text-ash leading-relaxed">
              Show order <span className="font-mono font-bold text-midnight">#{displayOrderId}</span> at the print counter to collect your prints.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function OrderStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center">
          <p className="text-body font-bold text-ash">Loading status...</p>
        </div>
      }
    >
      <OrderStatusContent />
    </Suspense>
  )
}
