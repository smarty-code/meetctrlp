"use client";

import React from "react";
import { ArrowLeft, Check, Copy, RefreshCw } from "lucide-react";
import { OrderTrackingData } from "../../types/tracking";
import {
  ORDER_STATUS_PRESENTATION,
  TRACKING_COPY,
} from "../../data/tracking-constants";
import { formatCurrency } from "../../lib/currency";

interface TrackingHeaderProps {
  order?: OrderTrackingData | null;
  copied?: boolean;
  onCopyReference?: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onNewOrder: () => void;
}

export function TrackingHeader({
  order,
  copied = false,
  onCopyReference,
  isRefreshing,
  onRefresh,
  onNewOrder,
}: TrackingHeaderProps) {
  const presentation = order
    ? ORDER_STATUS_PRESENTATION[order.status]
    : null;

  const totalDocuments = order?.documentSummary?.totalDocuments ?? 0;
  const formattedTotal = order
    ? formatCurrency(order.totalAmount, { currency: order.currency })
    : "";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-graphite/15 bg-paper/95 px-4 backdrop-blur-xs sm:px-6">
      {/* Left: Back Navigation Arrow + Title / Subtitle Info */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onNewOrder}
          aria-label="Back to home"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-charcoal transition-colors hover:bg-graphite/10 active:translate-y-px"
        >
          <ArrowLeft className="size-5 stroke-[2.2]" />
        </button>

        <div className="min-w-0">
          {order ? (
            <>
              {/* Order Reference Number with quick 1-tap Copy */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onCopyReference}
                  title="Click to copy Order ID"
                  aria-label={
                    copied
                      ? TRACKING_COPY.copiedFeedback
                      : `Copy Order ID: ${order.displayReference}`
                  }
                  className="group inline-flex items-center gap-1 cursor-pointer font-mono text-body sm:text-heading-sm font-extrabold uppercase tracking-wide text-midnight hover:text-ecto-green transition-colors"
                >
                  <span>ORDER #{order.displayReference}</span>
                  {copied ? (
                    <span className="flex items-center gap-0.5 rounded bg-eel-light px-1 py-0.2 text-[10px] font-sans font-bold text-midnight">
                      <Check className="size-3 text-ecto-green stroke-[3]" />
                      <span>Copied!</span>
                    </span>
                  ) : (
                    <Copy className="size-3 text-ash group-hover:text-charcoal transition-colors" />
                  )}
                </button>
              </div>

              {/* Subline: Total documents count only */}
              <p className="text-[12px] sm:text-caption font-medium text-ash leading-tight truncate">
                {totalDocuments} {totalDocuments === 1 ? "document" : "documents"}
              </p>
            </>
          ) : (
            <h1 className="font-heading text-heading-sm font-bold text-midnight">
              {TRACKING_COPY.headerTitle}
            </h1>
          )}
        </div>
      </div>

      {/* Right Actions: Refresh & New Order CTA */}
      <div className="flex shrink-0 items-center gap-2 pl-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={TRACKING_COPY.refreshAria}
          title={TRACKING_COPY.refreshAria}
          className="flex size-8 cursor-pointer items-center justify-center rounded-xl text-charcoal transition-colors hover:bg-graphite/10 disabled:opacity-50"
        >
          <RefreshCw
            className={`size-4 text-charcoal ${isRefreshing ? "animate-spin text-ecto-green" : ""}`}
          />
        </button>

        <button
          type="button"
          onClick={onNewOrder}
          aria-label={TRACKING_COPY.newOrderCTA}
          className="cursor-pointer text-caption font-bold tracking-wider text-macaw-blue uppercase hover:underline"
        >
          {TRACKING_COPY.newOrderCTA}
        </button>
      </div>
    </header>
  );
}
