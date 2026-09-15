"use client"

import React from "react"
import { MapPin, Store } from "lucide-react"
import { ShopContext } from "../../types/upload"

interface ShopSummaryCardProps {
  shop: ShopContext
}

export function ShopSummaryCard({ shop }: ShopSummaryCardProps) {
  const isOpen = shop.status === "OPEN" || shop.status === "BUSY"

  return (
    <section
      aria-labelledby="shop-summary-heading"
      className="rounded-xl border-2 border-graphite/20 bg-paper p-3.5 transition-colors sm:p-4"
    >
      {/* 1. Top Header: Shop Name + Status/Hours */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-graphite/20 bg-graphite/5">
            <Store className="size-4 text-ecto-green" />
          </div>
          <h2
            id="shop-summary-heading"
            className="text-[15px] sm:text-body font-bold text-midnight truncate"
          >
            {shop.name}
          </h2>
        </div>

        {/* Operating status / Hours */}
        <div className="shrink-0 flex items-center gap-1.5 text-[11px] sm:text-caption font-medium text-ash">
          {isOpen ? (
            <>
              <span
                className="size-2 rounded-full bg-ecto-green"
                aria-hidden="true"
              />
              <span className="font-semibold text-midnight">
                {shop.openTime && shop.closeTime
                  ? `${shop.openTime} – ${shop.closeTime}`
                  : "Open Now"}
              </span>
            </>
          ) : (
            <span className="text-destructive font-medium">Closed</span>
          )}
        </div>
      </div>

      {/* 2. Below Shop Name: Location / Address */}
      {shop.address && (
        <div className="mt-2.5 flex items-start gap-1.5 text-caption text-charcoal">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-ash" />
          <span className="leading-snug">{shop.address}</span>
        </div>
      )}
    </section>
  )
}

