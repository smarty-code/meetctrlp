"use client";

import React from "react";
import { CheckCircle2, CreditCard, Banknote } from "lucide-react";
import { OrderTrackingData } from "../../types/tracking";
import { formatCurrency } from "../../lib/currency";
import { TRACKING_COPY } from "../../data/tracking-constants";

interface TrackingPaymentCardProps {
  order: OrderTrackingData;
}

export function TrackingPaymentCard({ order }: TrackingPaymentCardProps) {
  const isCash = order.paymentMethod === "CASH";

  const formattedAmount = formatCurrency(order.totalAmount, {
    currency: order.currency,
  });

  return (
    <section
      aria-labelledby="payment-details-heading"
      className="space-y-4 rounded-xl border-2 border-graphite/20 bg-paper p-5 sm:p-6"
    >
      <div className="flex items-center justify-between border-b border-graphite/10 pb-3">
        <span
          id="payment-details-heading"
          className="text-caption font-bold tracking-wider text-ash uppercase"
        >
          {TRACKING_COPY.paymentCardTitle}
        </span>

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
    </section>
  );
}
