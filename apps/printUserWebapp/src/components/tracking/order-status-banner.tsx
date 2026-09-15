"use client";

import React from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  PackageCheck,
  Printer,
  XCircle,
} from "lucide-react";
import { OrderTrackingData } from "../../types/tracking";
import {
  ORDER_STATUS_PRESENTATION,
  TRACKING_COPY,
} from "../../data/tracking-constants";

interface OrderStatusBannerProps {
  order: OrderTrackingData;
  copied: boolean;
  onCopyReference: () => void;
}

export function OrderStatusBanner({
  order,
  copied,
  onCopyReference,
}: OrderStatusBannerProps) {
  const presentation = ORDER_STATUS_PRESENTATION[order.status];

  // Render proper icon based on presentation config
  const renderIcon = () => {
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

  // Visual container styles according to status type
  const isErrorOrCancel =
    order.status === "REJECTED" ||
    order.status === "CANCELLED" ||
    order.status === "FAILED";

  const isSuccessOrReady =
    order.status === "READY" || order.status === "COMPLETED";

  const containerBorderClass = isErrorOrCancel
    ? "border-amber-500/50 bg-amber-50/40"
    : isSuccessOrReady
      ? "border-ecto-green bg-eel-light/35"
      : "border-ecto-green/50 bg-eel-light/25";

  const iconBgClass = isErrorOrCancel
    ? "bg-amber-500 text-paper"
    : "bg-ecto-green text-paper";

  return (
    <div
      className={`rounded-xl border-2 p-3 sm:p-4 transition-colors ${containerBorderClass}`}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
            aria-hidden="true"
          >
            {renderIcon()}
          </div>

          <div className="min-w-0">
            <h2 className="text-body font-bold text-midnight leading-tight">
              {presentation.headline}
            </h2>
            <p className="text-[12px] sm:text-caption leading-tight text-charcoal">
              {presentation.customerDescription}
            </p>
          </div>
        </div>

        {/* Compact Order Reference Pill with Copy Action */}
        <div className="shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={onCopyReference}
            aria-label={
              copied
                ? TRACKING_COPY.copiedFeedback
                : `${TRACKING_COPY.copyOrderNumber}: ${order.displayReference}`
            }
            className="group inline-flex cursor-pointer items-center justify-between gap-1.5 rounded-lg border-2 border-graphite/20 bg-paper px-2.5 py-1 font-mono text-[12px] font-bold text-midnight transition-colors hover:border-graphite/40"
          >
            <div className="flex items-center gap-1">
              <Hash className="size-3 text-ash transition-colors group-hover:text-charcoal" />
              <span>{order.displayReference}</span>
            </div>
            <span className="flex items-center gap-1 border-l border-graphite/20 pl-1.5 font-sans text-[11px] font-medium text-ash transition-colors group-hover:text-midnight">
              {copied ? (
                <>
                  <Check className="size-3 stroke-[3] text-ecto-green" />
                  <span className="font-bold text-ecto-green">
                    {TRACKING_COPY.copiedFeedback}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="size-2.5" />
                  <span>Copy</span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
