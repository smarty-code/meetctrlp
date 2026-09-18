"use client"

import React from "react"
import { ShopStatus } from "../types/upload"
import { Clock } from "lucide-react"

interface ShopStatusCardProps {
  status: ShopStatus
  shopName?: string
  estimatedMinutes?: number
  statusMessage?: string
}

export const ShopStatusCard: React.FC<ShopStatusCardProps> = ({
  status = "OPEN",
  estimatedMinutes = 10,
  statusMessage,
}) => {
  const isAvailable = status === "OPEN" || status === "BUSY"

  return (
    <div className="-mt-2 w-full px-4">
      {/* 12px radius, flat border, paper white surface, no drop shadows */}
      <div className="w-full rounded-xl border-2 border-graphite/15 bg-paper p-5 text-center">
        {isAvailable ? (
          <div>
            <h2 className="font-heading text-heading-sm tracking-heading-sm text-midnight">
              {statusMessage || "We're ready to print!"}
            </h2>

            <p className="mx-auto mt-1 max-w-[280px] text-body leading-body font-medium text-charcoal">
              Your documents will be printed at this shop.
            </p>

            <div className="mt-3.5 flex items-center justify-center gap-2 border-t border-graphite/15 pt-3 text-caption font-bold text-macaw-blue">
              <Clock className="size-4 stroke-[2.5]" />
              <span>Estimated time: ~{estimatedMinutes} minutes</span>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="font-heading text-heading-sm tracking-heading-sm text-midnight">
              We&apos;ll be right back!
            </h2>

            <p className="mx-auto mt-1 max-w-[290px] text-body leading-body font-medium text-charcoal">
              This store is temporarily unavailable. We&apos;re working on it
              and will be back online shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
