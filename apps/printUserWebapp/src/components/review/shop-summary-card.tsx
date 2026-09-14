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
      {/* Top Header: Category Tag & Small Operating Hours */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-caption font-bold tracking-caption uppercase text-ash">
          <Store className="size-3.5 stroke-[2] text-ash" />
          <span id="shop-summary-heading">Print & Pickup</span>
        </div>

        {/* Operating Hours displayed in a small, subtle manner */}
        {shop.openTime && shop.closeTime ? (
          <div className="flex items-center gap-1.5 text-caption text-ash">
            {isOpen && (
              <span
                className="size-1.5 rounded-full bg-ecto-green"
                aria-hidden="true"
              />
            )}
            <span className="font-medium">
              {shop.openTime} – {shop.closeTime}
            </span>
          </div>
        ) : isOpen ? (
          <span className="flex items-center gap-1 text-caption font-medium text-ecto-green">
            <span className="size-1.5 rounded-full bg-ecto-green" />
            <span>Open Now</span>
          </span>
        ) : null}
      </div>

      {/* Main Content: Shop Name & Compact Address */}
      <div className="mt-1.5">
        <h2 className="text-body font-bold text-midnight sm:text-[16px]">
          {shop.name}
        </h2>
        {shop.address && (
          <p className="mt-0.5 flex items-start gap-1 text-caption text-charcoal">
            <MapPin className="mt-0.5 size-3 shrink-0 text-ash" />
            <span>{shop.address}</span>
          </p>
        )}
      </div>
    </section>
  )
}
