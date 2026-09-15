"use client";

import React from "react";
import { MapPin, Navigation, Phone } from "lucide-react";
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
      className="space-y-4 rounded-xl border-2 border-graphite/20 bg-paper p-5 sm:p-6"
    >
      <div className="border-b border-graphite/10 pb-3">
        <span
          id="shop-details-heading"
          className="text-caption font-bold tracking-wider text-ash uppercase"
        >
          {TRACKING_COPY.shopCardTitle}
        </span>
      </div>

      <div>
        <h3 className="text-heading-sm font-bold text-midnight">{shop.name}</h3>
        <p className="mt-1 flex items-start gap-1.5 text-caption leading-relaxed text-charcoal">
          <MapPin className="mt-0.5 size-4 shrink-0 text-ash" />
          <span>{shop.address}</span>
        </p>
      </div>

      {collectionInstructions && (
        <div className="rounded-xl border-2 border-graphite/10 bg-graphite/5 p-3.5">
          <span className="text-[11px] font-bold tracking-wider text-ash uppercase">
            {TRACKING_COPY.pickupInstructionsTitle}
          </span>
          <p className="mt-1 text-caption font-medium text-charcoal">
            {collectionInstructions}
          </p>
        </div>
      )}

      {/* Approved Shop Actions (Contact Shop / Directions) */}
      {(shop.phone || shop.mapUrl) && (
        <div className="flex items-center gap-2 pt-1">
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              aria-label={`${TRACKING_COPY.callShopCTA}: ${shop.phone}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-graphite/20 bg-paper px-3 py-2.5 text-caption font-bold text-charcoal transition-colors hover:border-graphite/40"
            >
              <Phone className="size-3.5 text-ash" />
              <span>{TRACKING_COPY.callShopCTA}</span>
            </a>
          )}

          {shop.mapUrl && (
            <a
              href={shop.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${TRACKING_COPY.directionsCTA} to ${shop.name}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-lingot-lime bg-paper px-3 py-2.5 text-caption font-bold text-midnight transition-colors hover:bg-eel-light/20"
            >
              <Navigation className="size-3.5 text-midnight" />
              <span>{TRACKING_COPY.directionsCTA}</span>
            </a>
          )}
        </div>
      )}
    </section>
  );
}
