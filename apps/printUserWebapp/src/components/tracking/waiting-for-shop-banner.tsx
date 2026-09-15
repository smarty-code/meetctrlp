"use client";

import React from "react";
import { Clock, Info } from "lucide-react";
import { TRACKING_COPY } from "../../data/tracking-constants";

interface WaitingForShopBannerProps {
  estimatedReadyTime?: string;
  estimatedMinutes?: number;
}

export function WaitingForShopBanner({
  estimatedReadyTime,
  estimatedMinutes,
}: WaitingForShopBannerProps) {
  return (
    <section
      aria-labelledby="waiting-for-shop-heading"
      className="rounded-xl border-2 border-lingot-lime/60 bg-eel-light/20 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper border border-lingot-lime text-midnight"
          aria-hidden="true"
        >
          <Clock className="size-4 text-midnight stroke-[2.5]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              id="waiting-for-shop-heading"
              className="text-body font-bold text-midnight leading-tight"
            >
              {TRACKING_COPY.waitingForShopTitle}
            </h3>
            <span className="rounded-full border border-lingot-lime bg-paper px-2 py-0.5 font-mono text-[10px] font-bold text-midnight uppercase">
              Current State
            </span>
          </div>

          <p className="mt-1 text-caption leading-relaxed text-charcoal">
            {TRACKING_COPY.waitingForShopDescription}
          </p>

          {/* Display estimated completion if reliable backend data exists */}
          {estimatedReadyTime && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-graphite/10 bg-paper px-2.5 py-1 text-caption text-charcoal">
              <Info className="size-3.5 text-ash" />
              <span>
                Estimated ready time:{" "}
                <strong className="font-bold text-midnight">
                  {estimatedReadyTime}
                </strong>
              </span>
            </div>
          )}

          {!estimatedReadyTime && estimatedMinutes && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-graphite/10 bg-paper px-2.5 py-1 text-caption text-charcoal">
              <Info className="size-3.5 text-ash" />
              <span>
                Estimated turnaround:{" "}
                <strong className="font-bold text-midnight">
                  ~{estimatedMinutes} mins
                </strong>{" "}
                after acceptance
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
