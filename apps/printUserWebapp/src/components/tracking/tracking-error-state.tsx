"use client";

import React from "react";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { TRACKING_COPY } from "../../data/tracking-constants";

interface TrackingErrorStateProps {
  errorMessage?: string;
  onRetry: () => void;
  onNewOrder: () => void;
}

export function TrackingErrorState({
  errorMessage,
  onRetry,
  onNewOrder,
}: TrackingErrorStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full border-2 border-amber-500/40 bg-amber-50 text-amber-800">
        <AlertCircle className="size-8 stroke-[2.5]" />
      </div>

      <h2 className="mt-4 text-heading font-bold text-midnight">
        {TRACKING_COPY.fetchFailedTitle}
      </h2>

      <p className="mt-2 max-w-sm text-body leading-relaxed text-charcoal">
        {errorMessage || TRACKING_COPY.fetchFailedDescription}
      </p>

      <div className="mt-6 flex w-full max-w-xs flex-col items-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-b-4 border-ecto-green/70 bg-ecto-green px-4 py-3 text-body font-bold text-paper transition-all hover:brightness-105 active:translate-y-1 active:border-b-0"
        >
          <RefreshCw className="size-4" />
          <span>{TRACKING_COPY.retryCTA}</span>
        </button>

        <button
          type="button"
          onClick={onNewOrder}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-graphite/20 bg-paper px-4 py-2.5 text-body font-bold text-charcoal transition-colors hover:border-graphite/40"
        >
          <ArrowLeft className="size-4 text-ash" />
          <span>{TRACKING_COPY.newOrderCTA}</span>
        </button>
      </div>
    </div>
  );
}
