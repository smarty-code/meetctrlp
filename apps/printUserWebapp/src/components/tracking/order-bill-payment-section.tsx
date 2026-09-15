"use client";

import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { OrderTrackingData } from "../../types/tracking";
import { formatCurrency } from "../../lib/currency";

interface OrderBillPaymentSectionProps {
  order: OrderTrackingData;
}

export function OrderBillPaymentSection({
  order,
}: OrderBillPaymentSectionProps) {
  const isOnlinePaid =
    order.paymentMethod === "ONLINE" || order.paymentState === "SUCCESS";
  const isCashAtCounter =
    order.paymentMethod === "CASH" ||
    order.paymentState === "CASH_PENDING" ||
    order.paymentState === "METHOD_SELECTED";

  return (
    <section aria-labelledby="bill-details-heading" className="w-full">
      {/* 1. Section Header Strip */}
      <div className="bg-graphite/5 px-4 py-2 sm:px-6">
        <h2
          id="bill-details-heading"
          className="text-[11px] font-bold tracking-wider text-ash uppercase"
        >
          Bill Details
        </h2>
      </div>

      {/* 2. Bill Summary Content */}
      <div className="bg-paper px-4 py-3.5 sm:px-6 space-y-2.5">
        {/* Item Total */}
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-charcoal font-medium">Item Total</span>
          <span className="font-semibold text-midnight">
            {formatCurrency(order.totalAmount, { currency: order.currency })}
          </span>
        </div>

        {/* Payment Status / Method Row */}
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-charcoal font-medium">Payment Status</span>
          {isOnlinePaid ? (
            <span className="inline-flex items-center gap-1 font-semibold text-ecto-green">
              <CheckCircle2 className="size-3.5 stroke-[2.5]" />
              Paid Online (Verified)
            </span>
          ) : isCashAtCounter ? (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
              <AlertCircle className="size-3.5 stroke-[2]" />
              Pay at Shop Counter
            </span>
          ) : (
            <span className="font-semibold text-ash">
              {order.paymentState}
            </span>
          )}
        </div>

        {/* Counter Payment Advisory (if Pay at Counter) */}
        {isCashAtCounter && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[12px] text-amber-900 leading-snug">
            <span className="font-semibold">Pay at counter:</span> Please pay{" "}
            <span className="font-bold">
              {formatCurrency(order.totalAmount, { currency: order.currency })}
            </span>{" "}
            at the shop desk via Cash or UPI QR when collecting your prints.
          </div>
        )}

        {/* Dotted Divider */}
        <div className="border-t border-dashed border-graphite/20 pt-2" />

        {/* Grand Total Row */}
        <div className="flex items-center justify-between">
          <span className="text-body font-bold text-midnight">Grand Total</span>
          <span className="text-body font-bold text-midnight">
            {formatCurrency(order.totalAmount, { currency: order.currency })}
          </span>
        </div>
      </div>
    </section>
  );
}
