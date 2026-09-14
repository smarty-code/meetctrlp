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
        return <PackageCheck className="size-7 stroke-[2.5]" />;
      case "printer":
        return <Printer className="size-7 stroke-[2.5]" />;
      case "clock":
        return <Clock className="size-7 stroke-[2.5]" />;
      case "alert-circle":
        return <AlertCircle className="size-7 stroke-[2.5]" />;
      case "x-circle":
        return <XCircle className="size-7 stroke-[2.5]" />;
      case "check-circle":
      default:
        return <CheckCircle2 className="size-7 stroke-[2.5]" />;
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
      className={`rounded-xl border-2 p-5 text-center transition-colors sm:p-6 ${containerBorderClass}`}
    >
      <div
        className={`mx-auto flex size-14 items-center justify-center rounded-full ${iconBgClass}`}
        aria-hidden="true"
      >
        {renderIcon()}
      </div>

      <h2 className="mt-3.5 text-heading leading-tight font-bold text-midnight">
        {presentation.headline}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-body leading-relaxed text-charcoal">
        {presentation.customerDescription}
      </p>

      {/* Order Reference Pill with Copy Action */}
      <div className="mt-4 inline-flex items-center gap-2">
        <button
          type="button"
          onClick={onCopyReference}
          aria-label={
            copied
              ? TRACKING_COPY.copiedFeedback
              : `${TRACKING_COPY.copyOrderNumber}: ${order.displayReference}`
          }
          className="group inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-graphite/20 bg-paper px-3.5 py-1.5 font-mono text-body font-bold text-midnight transition-colors hover:border-graphite/40"
        >
          <Hash className="size-4 text-ash transition-colors group-hover:text-charcoal" />
          <span>{order.displayReference}</span>
          <span className="flex items-center gap-1 border-l border-graphite/20 pl-2 font-sans text-caption font-medium text-ash transition-colors group-hover:text-midnight">
            {copied ? (
              <>
                <Check className="size-3.5 stroke-[3] text-ecto-green" />
                <span className="font-bold text-ecto-green">
                  {TRACKING_COPY.copiedFeedback}
                </span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy</span>
              </>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
