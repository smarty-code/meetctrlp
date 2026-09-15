"use client"

import React from "react"
import { REVIEW_COPY } from "../../data/review-constants"

export function ReviewLoadingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={REVIEW_COPY.loadingOrder}
      className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4 sm:px-6 animate-pulse"
    >
      {/* Shop Summary Skeleton */}
      <div className="h-20 rounded-xl border-2 border-graphite/10 bg-graphite/5 p-3.5" />

      {/* Unified Document Review Card Skeleton */}
      <div className="overflow-hidden rounded-xl border-2 border-graphite/10 bg-graphite/5 divide-y-2 divide-graphite/10">
        <div className="h-12 bg-graphite/10 px-5" />
        <div className="h-24 p-5" />
        <div className="h-24 p-5" />
      </div>

      {/* Price Summary Skeleton */}
      <div className="h-40 rounded-xl border-2 border-graphite/10 bg-graphite/5 p-4" />
    </div>
  )
}
