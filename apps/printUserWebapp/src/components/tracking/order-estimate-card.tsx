"use client";

import React from "react";
import { Clock } from "lucide-react";
import { TRACKING_COPY } from "../../data/tracking-constants";

interface OrderEstimateCardProps {
  estimatedTime?: string;
  isReadyOrComplete: boolean;
}

export function OrderEstimateCard({
  estimatedTime,
  isReadyOrComplete,
}: OrderEstimateCardProps) {
  // If order is already ready or completed, hide or show completed message
  if (isReadyOrComplete) {
    return null;
  }

  return (
    <div className="rounded-xl border-2 border-graphite/20 bg-paper p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-ecto-green/40 bg-eel-light text-midnight">
          <Clock className="size-5 stroke-[2.5] text-midnight" />
        </div>

        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-bold tracking-wider text-ash uppercase">
            {TRACKING_COPY.estimatedTimeTitle}
          </span>
          <p className="mt-0.5 truncate text-heading-sm font-bold text-midnight">
            {estimatedTime || TRACKING_COPY.noEstimateAvailable}
          </p>
        </div>
      </div>
    </div>
  );
}
