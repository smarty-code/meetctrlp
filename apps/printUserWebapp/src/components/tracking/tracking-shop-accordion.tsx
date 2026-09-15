"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Info } from "lucide-react";
import { TrackingShopInfo } from "../../types/tracking";

interface TrackingShopAccordionProps {
  shop: TrackingShopInfo;
  collectionInstructions?: string;
  displayReference: string;
}

export function TrackingShopAccordion({
  shop,
  collectionInstructions,
  displayReference,
}: TrackingShopAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section aria-labelledby="shop-details-heading" className="w-full">
      {/* 1. Gray Section Header Strip */}
      <div className="bg-graphite/5 px-4 py-2 sm:px-6">
        <h2
          id="shop-details-heading"
          className="text-[11px] font-bold tracking-wider text-ash uppercase"
        >
          Print Shop Details
        </h2>
      </div>

      {/* 2. Accordion Card Container */}
      <div className="p-4 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-graphite/15 bg-paper transition-all">
          {/* Clickable Card Header / Trigger */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-graphite/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ecto-green"
            aria-expanded={isOpen}
            aria-controls="shop-accordion-details"
          >
            <div className="flex items-start gap-3 min-w-0 pr-2">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-eel-light text-midnight">
                <MapPin className="size-4 text-midnight" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-midnight leading-tight truncate">
                  {shop.name}
                </p>
                <p className="text-[12px] font-medium text-ash truncate mt-0.5">
                  {shop.address}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 text-ash text-[12px] font-semibold">
              <span>{isOpen ? "Hide" : "View"}</span>
              {isOpen ? (
                <ChevronUp className="size-4 text-midnight" />
              ) : (
                <ChevronDown className="size-4 text-midnight" />
              )}
            </div>
          </button>

          {/* Expanded Card Details */}
          {isOpen && (
            <div
              id="shop-accordion-details"
              className="p-3.5 border-t border-graphite/10 bg-graphite/[0.02] space-y-3"
            >
              {/* Full Address */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ash mb-1">
                  Shop Location
                </p>
                <p className="text-[13px] text-midnight font-medium leading-relaxed">
                  {shop.address}
                </p>
              </div>

              {/* Instant Counter Pickup Instructions */}
              <div className="rounded-lg bg-eel-light p-3 space-y-1 border border-graphite/10">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-midnight">
                  <Info className="size-3.5 text-midnight shrink-0" />
                  <span>Pickup at Counter</span>
                </div>
                <p className="text-[12px] text-charcoal leading-snug">
                  {collectionInstructions ||
                    shop.counterInstructions ||
                    `Show Order #${displayReference} at the shop desk to collect your prints once status is Ready.`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
