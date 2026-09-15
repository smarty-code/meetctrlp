"use client";

import React from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  Home,
  PackageCheck,
  Printer,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { OrderTrackingData } from "../../types/tracking";
import {
  ORDER_STATUS_PRESENTATION,
  TRACKING_COPY,
} from "../../data/tracking-constants";

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

  const renderStatusIcon = () => {
    if (!presentation) {
      return <CheckCircle2 className="size-5 stroke-[2.5] text-ecto-green" />;
    }

    switch (presentation.iconName) {
      case "package-check":
        return <PackageCheck className="size-5 stroke-[2.5]" />;
      case "printer":
        return <Printer className="size-5 stroke-[2.5]" />;
      case "clock":
        return <Clock className="size-5 stroke-[2.5]" />;
      case "alert-circle":
        return <AlertCircle className="size-5 stroke-[2.5]" />;
      case "x-circle":
        return <XCircle className="size-5 stroke-[2.5]" />;
      case "check-circle":
      default:
        return <CheckCircle2 className="size-5 stroke-[2.5]" />;
    }
  };

  const isErrorOrCancel =
    order &&
    (order.status === "REJECTED" ||
      order.status === "CANCELLED" ||
      order.status === "FAILED");

  const iconBgClass = isErrorOrCancel
    ? "border-amber-400 bg-amber-100 text-amber-900"
    : "border-ecto-green/50 bg-eel-light text-midnight";

  return (
    <header className="sticky top-0 z-30 flex min-h-16 w-full items-center justify-between border-b-2 border-graphite/20 bg-paper/95 px-4 py-2 backdrop-blur-xs sm:px-6">
      {/* Left: Status Icon + Direct Status Title + Order ID Reference Pill */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl border-2 ${iconBgClass}`}
          aria-hidden="true"
        >
          {renderStatusIcon()}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2.5">
          <h1 className="text-body font-bold tracking-tight text-midnight sm:text-heading-sm leading-tight">
            {presentation ? presentation.label : TRACKING_COPY.headerTitle}
          </h1>

          {/* Customer Order Reference Pill with accessible Copy */}
          {order && (
            <div className="mt-0.5 sm:mt-0">
              <button
                type="button"
                onClick={onCopyReference}
                aria-label={
                  copied
                    ? TRACKING_COPY.copiedFeedback
                    : `${TRACKING_COPY.copyOrderNumber}: ${order.displayReference}`
                }
                className="group inline-flex cursor-pointer items-center gap-1 rounded-md border border-graphite/25 bg-paper px-2 py-0.5 font-mono text-[11px] font-bold text-midnight transition-colors hover:border-graphite/40"
              >
                <Hash className="size-2.5 text-ash transition-colors group-hover:text-charcoal" />
                <span>{order.displayReference}</span>
                <span className="border-l border-graphite/20 pl-1 font-sans text-[10px] font-medium text-ash transition-colors group-hover:text-midnight">
                  {copied ? (
                    <span className="font-bold text-ecto-green">
                      {TRACKING_COPY.copiedFeedback}
                    </span>
                  ) : (
                    <Copy className="size-2.5" />
                  )}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Actions: Refresh & Home / New Order */}
      <div className="flex shrink-0 items-center gap-2 pl-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label={TRACKING_COPY.refreshAria}
          title={TRACKING_COPY.refreshAria}
          className="flex size-8 cursor-pointer items-center justify-center rounded-xl border-2 border-graphite/20 bg-paper text-charcoal transition-colors hover:border-graphite/40 disabled:opacity-50"
        >
          <RefreshCw
            className={`size-3.5 text-charcoal ${isRefreshing ? "animate-spin text-ecto-green" : ""}`}
          />
        </button>

        <button
          type="button"
          onClick={onNewOrder}
          aria-label={TRACKING_COPY.newOrderCTA}
          className="flex cursor-pointer items-center gap-1 rounded-xl border-2 border-graphite/20 bg-paper px-2.5 py-1 text-caption font-bold text-charcoal transition-colors hover:border-graphite/40"
        >
          <Home className="size-3.5" />
          <span className="hidden sm:inline">{TRACKING_COPY.newOrderCTA}</span>
        </button>
      </div>
    </header>
  );
}
