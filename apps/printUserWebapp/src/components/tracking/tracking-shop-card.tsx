"use client";

import React from "react";
import { MapPin } from "lucide-react";
import { TrackingShopInfo } from "../../types/tracking";
import { TRACKING_COPY } from "../../data/tracking-constants";

interface TrackingShopCardProps {
  shop: TrackingShopInfo;
  collectionInstructions?: string;
}

export function TrackingShopCard({
  shop,
  collectionInstructions,
}: TrackingShopCardProps) {
  return (
    <section
      aria-labelledby="shop-details-heading"
      className="space-y-3 rounded-xl border-2 border-graphite/20 bg-paper p-3.5 sm:p-4"
    >
      <div className="border-b border-graphite/10 pb-2">
        <span
          id="shop-details-heading"
          className="text-caption font-bold tracking-wider text-ash uppercase"
        >
          {TRACKING_COPY.shopCardTitle}
        </span>
      </div>

      <div>
        <h3 className="text-body font-bold text-midnight sm:text-heading-sm">
          {shop.name}
        </h3>
        <p className="mt-1 flex items-start gap-1.5 text-caption leading-relaxed text-charcoal">
          <MapPin className="mt-0.5 size-4 shrink-0 text-ash" />
          <span>{shop.address}</span>
        </p>
      </div>

      {collectionInstructions && (
        <div className="rounded-lg border border-graphite/10 bg-graphite/5 p-3">
          <span className="text-[11px] font-bold tracking-wider text-ash uppercase">
            {TRACKING_COPY.pickupInstructionsTitle}
          </span>
          <p className="mt-0.5 text-caption font-medium leading-relaxed text-charcoal">
            {collectionInstructions}
          </p>
        </div>
      )}
    </section>
  );
}
