"use client"

import React from "react"
import { PAYMENT_COPY } from "../../data/payment-constants"

export function PaymentLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label={PAYMENT_COPY.loadingDetails}
      className="space-y-6 px-4 py-4 sm:px-6 animate-pulse"
    >
      {/* Summary Skeleton */}
      <div className="h-44 w-full rounded-xl border-2 border-graphite/10 bg-graphite/5" />

      {/* Methods Skeleton */}
      <div className="space-y-3">
        <div className="h-5 w-48 rounded-md bg-graphite/10" />
        <div className="h-24 w-full rounded-xl border-2 border-graphite/10 bg-graphite/5" />
        <div className="h-24 w-full rounded-xl border-2 border-graphite/10 bg-graphite/5" />
      </div>

      {/* Button Skeleton */}
      <div className="h-14 w-full rounded-xl bg-graphite/10" />
    </div>
  )
}
