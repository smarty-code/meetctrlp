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
      className={`rounded-xl border-2 p-4 transition-colors sm:p-5 ${containerBorderClass}`}
    >
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:items-center">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconBgClass}`}
            aria-hidden="true"
          >
            {renderIcon()}
          </div>

          <div>
            <h2 className="text-body font-bold text-midnight sm:text-heading-sm leading-tight">
              {presentation.headline}
            </h2>
            <p className="mt-0.5 text-caption leading-normal text-charcoal">
              {presentation.customerDescription}
            </p>
          </div>
        </div>

        {/* Compact Order Reference Pill with Copy Action */}
        <div className="sm:shrink-0">
          <button
            type="button"
            onClick={onCopyReference}
            aria-label={
              copied
                ? TRACKING_COPY.copiedFeedback
                : `${TRACKING_COPY.copyOrderNumber}: ${order.displayReference}`
            }
            className="group inline-flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-2 border-graphite/20 bg-paper px-3 py-1.5 font-mono text-caption font-bold text-midnight transition-colors hover:border-graphite/40 sm:w-auto"
          >
            <div className="flex items-center gap-1.5">
              <Hash className="size-3.5 text-ash transition-colors group-hover:text-charcoal" />
              <span>{order.displayReference}</span>
            </div>
            <span className="flex items-center gap-1 border-l border-graphite/20 pl-2 font-sans text-caption font-medium text-ash transition-colors group-hover:text-midnight">
              {copied ? (
                <>
                  <Check className="size-3 stroke-[3] text-ecto-green" />
                  <span className="font-bold text-ecto-green">
                    {TRACKING_COPY.copiedFeedback}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
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
