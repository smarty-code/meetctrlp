"use client";

import React, { Suspense } from "react";
import { useOrderTracking } from "../../hooks/use-order-tracking";
import { TrackingHeader } from "../../components/tracking/tracking-header";
import { OrderCompactTimeline } from "../../components/tracking/order-compact-timeline";
import { OrderItemDetailsSection } from "../../components/tracking/order-item-details-section";
import { OrderBillPaymentSection } from "../../components/tracking/order-bill-payment-section";
import { TrackingShopAccordion } from "../../components/tracking/tracking-shop-accordion";
import { TrackingLoadingSkeleton } from "../../components/tracking/tracking-loading-skeleton";
import { TrackingErrorState } from "../../components/tracking/tracking-error-state";
import { TrackingSimulatorBar } from "../../components/tracking/tracking-simulator-bar";

function OrderStatusContent() {
  const {
    order,
    isLoading,
    isRefreshing,
    error,
    copied,
    copyOrderReference,
    refresh,
    setStatus,
    startNewOrder,
    retryLoad,
  } = useOrderTracking();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-charcoal">
        <TrackingHeader
          isRefreshing={false}
          onRefresh={() => {}}
          onNewOrder={startNewOrder}
        />
        <TrackingLoadingSkeleton />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-charcoal">
        <TrackingHeader
          isRefreshing={false}
          onRefresh={retryLoad}
          onNewOrder={startNewOrder}
        />
        <TrackingErrorState
          errorMessage={error}
          onRetry={retryLoad}
          onNewOrder={startNewOrder}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-charcoal">
        <TrackingHeader
          isRefreshing={false}
          onRefresh={retryLoad}
          onNewOrder={startNewOrder}
        />
        <TrackingErrorState
          errorMessage="No order details could be retrieved."
          onRetry={retryLoad}
          onNewOrder={startNewOrder}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-charcoal">
      {/* 1. Header: Back navigation, ORDER #<ID> with copy, status & item/price subtitle, NEW ORDER action */}
      <TrackingHeader
        order={order}
        copied={copied}
        onCopyReference={copyOrderReference}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        onNewOrder={startNewOrder}
      />

      {/* Main Container - Cardless, streamlined sequence matching design specification */}
      <main className="mx-auto w-full max-w-2xl flex-1 pb-16 space-y-0">
        {/* 2. Order Progress Tracker (Compact vertical node trail) */}
        <div className="border-b border-graphite/10 py-1">
          <OrderCompactTimeline steps={order.timeline} />
        </div>

        {/* 3. Item Details (Section strip + itemized documents with copies, specs & line-item prices) */}
        <div className="border-b border-graphite/10">
          <OrderItemDetailsSection order={order} />
        </div>

        {/* 4. Total Order Bill Details (Item Total, Payment status/counter instructions, Grand Total) */}
        <div className="border-b border-graphite/10">
          <OrderBillPaymentSection order={order} />
        </div>

        {/* 5. Print Shop Details (Accordion with location and instant pickup instructions) */}
        <div>
          <TrackingShopAccordion
            shop={order.shop}
            collectionInstructions={order.collectionInstructions}
            displayReference={order.displayReference}
          />
        </div>
      </main>

      {/* Status Transition Simulator (for testing Screen 06 -> Screen 07 -> Screen 08 transitions) */}
      <TrackingSimulatorBar
        currentStatus={order.status}
        onSelectStatus={setStatus}
      />
    </div>
  );
}

export default function OrderStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-paper text-charcoal">
          <TrackingLoadingSkeleton />
        </div>
      }
    >
      <OrderStatusContent />
    </Suspense>
  );
}
