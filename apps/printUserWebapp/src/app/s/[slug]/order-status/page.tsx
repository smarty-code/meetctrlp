"use client";

import React, { Suspense } from "react";
import { useOrderTracking } from "../../../../hooks/use-order-tracking";
import { TrackingHeader } from "../../../../components/tracking/tracking-header";
import { OrderCompactTimeline } from "../../../../components/tracking/order-compact-timeline";
import { OrderItemDetailsSection } from "../../../../components/tracking/order-item-details-section";
import { OrderBillPaymentSection } from "../../../../components/tracking/order-bill-payment-section";
import { TrackingShopAccordion } from "../../../../components/tracking/tracking-shop-accordion";
import { TrackingLoadingSkeleton } from "../../../../components/tracking/tracking-loading-skeleton";
import { TrackingErrorState } from "../../../../components/tracking/tracking-error-state";

function OrderStatusContent() {
  const {
    order,
    isLoading,
    isRefreshing,
    error,
    copied,
    copyOrderReference,
    refresh,
    startNewOrder,
    retryLoad,
  } = useOrderTracking();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-charcoal">
        <TrackingHeader isRefreshing={false} onRefresh={() => {}} onNewOrder={startNewOrder} />
        <TrackingLoadingSkeleton />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-charcoal">
        <TrackingHeader isRefreshing={false} onRefresh={retryLoad} onNewOrder={startNewOrder} />
        <TrackingErrorState errorMessage={error} onRetry={retryLoad} onNewOrder={startNewOrder} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col bg-paper text-charcoal">
        <TrackingHeader isRefreshing={false} onRefresh={retryLoad} onNewOrder={startNewOrder} />
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
      <TrackingHeader
        order={order}
        copied={copied}
        onCopyReference={copyOrderReference}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        onNewOrder={startNewOrder}
      />
      <main className="mx-auto w-full max-w-2xl flex-1 pb-16 space-y-0">
        <div className="border-b border-graphite/10 py-1">
          <OrderCompactTimeline steps={order.timeline} />
        </div>
        <div className="border-b border-graphite/10">
          <OrderItemDetailsSection order={order} />
        </div>
        <div className="border-b border-graphite/10">
          <OrderBillPaymentSection order={order} />
        </div>
        <div>
          <TrackingShopAccordion
            shop={order.shop}
            collectionInstructions={order.collectionInstructions}
            displayReference={order.displayReference}
          />
        </div>
      </main>
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
