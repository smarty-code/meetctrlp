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
      aria-labelledby="documents-payment-heading"
      className="space-y-4 rounded-xl border-2 border-graphite/20 bg-paper p-5 sm:p-6"
    >
      {/* Header: Section Title + Payment Status Badge */}
      <div className="flex items-center justify-between border-b border-graphite/10 pb-3">
        <div>
          <h3
            id="documents-payment-heading"
            className="text-caption font-bold tracking-wider text-ash uppercase"
          >
            Order Details & Payment
          </h3>
        </div>

        {/* Payment Status Badge */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-bold ${
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
              <CheckCircle2 className="size-3.5 stroke-[3] text-ecto-green" />
              <span>{TRACKING_COPY.paidOnlineBadge}</span>
            </>
          )}
        </span>
      </div>

      {/* Document List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-caption font-bold text-ash">
          <span>
            {TRACKING_COPY.documentsCountLabel(
              documentSummary.totalDocuments,
              documentSummary.totalPages,
            )}
          </span>
          <span>
            {documentSummary.totalCopies}{" "}
            {documentSummary.totalCopies === 1 ? "copy" : "copies"}
          </span>
        </div>

        <div className="space-y-2 pt-1">
          {documentSummary.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-graphite/10 bg-graphite/5 px-3 py-2.5 text-caption"
            >
              <div className="flex min-w-0 items-center gap-2.5 pr-2">
                <FileText className="size-4 shrink-0 text-ash" />
                <span className="truncate font-bold text-midnight">
                  {item.name}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 font-medium text-ash">
                <span>{item.pages} pp</span>
                <span>•</span>
                <span className="font-mono text-[11px] font-bold uppercase">
                  {item.colorMode}
                </span>
                <span>•</span>
                <span>{item.paperSize}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment & Amount Summary */}
      <div className="border-t border-graphite/10 pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCash ? (
              <Banknote className="size-5 text-ash" />
            ) : (
              <CreditCard className="size-5 text-ash" />
            )}
            <span className="text-body font-bold text-midnight">
              {isCash
                ? TRACKING_COPY.amountDueLabel
                : TRACKING_COPY.amountPaidLabel}
            </span>
          </div>

          <span className="text-heading-sm font-bold text-midnight">
            {formattedAmount}
          </span>
        </div>

        {isCash && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-caption text-ash">
            Please keep exact cash ready or scan the shop UPI QR at the counter
            during document pickup.
          </p>
        )}
      </div>
    </section>
  );
}
