"use client";

import React from "react";
import { CheckCircle2, Home, RefreshCw } from "lucide-react";
import { TRACKING_COPY } from "../../data/tracking-constants";

interface TrackingHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
  onNewOrder: () => void;
}

export function TrackingHeader({
  isRefreshing,
  onRefresh,
  onNewOrder,
}: TrackingHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b-2 border-graphite/20 bg-paper/95 px-4 backdrop-blur-xs sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl border-2 border-ecto-green/50 bg-eel-light text-midnight">
          <CheckCircle2 className="size-6 stroke-[2.5] text-ecto-green" />
        </div>
        <div>
          <h1 className="text-heading-sm font-bold tracking-heading-sm text-midnight">
            {TRACKING_COPY.headerTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={TRACKING_COPY.refreshAria}
          title={TRACKING_COPY.refreshAria}
          className="flex size-9 items-center justify-center rounded-xl border-2 border-graphite/20 bg-paper text-charcoal transition-colors hover:border-graphite/40 disabled:opacity-50"
        >
          <RefreshCw
            className={`size-4 text-charcoal ${isRefreshing ? "animate-spin text-ecto-green" : ""}`}
          />
        </button>

        <button
          type="button"
          onClick={onNewOrder}
          aria-label={TRACKING_COPY.newOrderCTA}
          className="flex items-center gap-1.5 rounded-xl border-2 border-graphite/20 bg-paper px-3 py-1.5 text-caption font-bold text-charcoal transition-colors hover:border-graphite/40"
        >
          <Home className="size-4" />
          <span className="hidden sm:inline">{TRACKING_COPY.newOrderCTA}</span>
        </button>
      </div>
    </header>
  );
}
