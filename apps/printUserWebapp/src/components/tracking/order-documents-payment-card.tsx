"use client";

import React from "react";
import { Banknote, CheckCircle2, CreditCard, FileText } from "lucide-react";
import { OrderTrackingData } from "../../types/tracking";
import { formatCurrency } from "../../lib/currency";
import { TRACKING_COPY } from "../../data/tracking-constants";

interface OrderDocumentsPaymentCardProps {
  order: OrderTrackingData;
}

export function OrderDocumentsPaymentCard({
  order,
}: OrderDocumentsPaymentCardProps) {
  const isCash = order.paymentMethod === "CASH";
  const formattedAmount = formatCurrency(order.totalAmount, {
    currency: order.currency,
  });

  const { documentSummary } = order;

  return (
    <section
      aria-labelledby="documents-heading"
      className="space-y-3.5 rounded-xl border-2 border-graphite/20 bg-paper p-3.5 sm:p-4"
    >
      {/* 1. Card Header */}
      <div className="flex items-center justify-between border-b border-graphite/10 pb-2">
        <h3
          id="documents-heading"
          className="text-caption font-bold tracking-wider text-ash uppercase"
        >
          Order Details
        </h3>
        <span className="text-[11px] font-bold text-ash">
          {documentSummary.items.length}{" "}
          {documentSummary.items.length === 1 ? "document" : "documents"}
        </span>
      </div>

      {/* 2. Documents Listed One by One */}
      <div className="space-y-2">
        {documentSummary.items.map((item, idx) => (
          <div
            key={item.id || `doc-${idx}`}
            className="rounded-lg border border-graphite/15 bg-graphite/5 p-2.5"
          >
            {/* Document Title Row */}
            <div className="flex items-center gap-2">
              <FileText className="size-3.5 shrink-0 text-ash" />
              <p
                title={item.name}
                className="truncate text-caption font-bold text-midnight"
              >
                {item.name}
              </p>
            </div>

            {/* Individual Specification Tags */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded border border-graphite/15 bg-paper px-2 py-0.5 font-bold text-midnight">
                {item.copies} {item.copies === 1 ? "copy" : "copies"}
              </span>
              <span className="rounded border border-graphite/15 bg-paper px-2 py-0.5 font-medium text-charcoal">
                {item.pages} {item.pages === 1 ? "page" : "pages"}
              </span>
              <span className="rounded border border-graphite/15 bg-paper px-2 py-0.5 font-medium text-charcoal">
                {item.colorMode === "color" ? "Color" : "Black & White"}
              </span>
              <span className="rounded border border-graphite/15 bg-paper px-2 py-0.5 font-medium text-charcoal">
                {item.paperSize}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Payment Details - Cleanly Aligned */}
      <div className="border-t border-graphite/10 pt-3 space-y-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Payment Method Badge */}
          <div className="flex items-center">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                isCash
                  ? "border border-amber-300 bg-amber-100 text-amber-900"
                  : "border border-ecto-green/40 bg-eel-light text-midnight"
              }`}
            >
              {isCash ? (
                <>
                  <Banknote className="size-3.5 text-amber-800" />
                  <span>{TRACKING_COPY.payAtShopBadge}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 stroke-[2.5] text-ecto-green" />
                  <span>{TRACKING_COPY.paidOnlineBadge}</span>
                </>
              )}
            </span>
          </div>

          {/* Amount Due / Paid */}
          <div className="flex items-baseline justify-between sm:justify-end gap-2">
            <span className="text-[12px] font-medium text-ash">
              {isCash
                ? TRACKING_COPY.amountDueLabel
                : TRACKING_COPY.amountPaidLabel}
            </span>
            <span className="text-body font-bold text-midnight sm:text-heading-sm">
              {formattedAmount}
            </span>
          </div>
        </div>

        {isCash && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900 leading-snug">
            Please keep cash ready or scan the shop UPI QR at the counter during document pickup.
          </p>
        )}
      </div>
    </section>
  );
}
