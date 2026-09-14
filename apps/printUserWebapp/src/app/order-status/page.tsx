"use client";

import React, { Suspense } from "react";
import { useOrderTracking } from "../../hooks/use-order-tracking";
import { TrackingHeader } from "../../components/tracking/tracking-header";
import { OrderStatusBanner } from "../../components/tracking/order-status-banner";
import { OrderDocumentsPaymentCard } from "../../components/tracking/order-documents-payment-card";
import { OrderTimeline } from "../../components/tracking/order-timeline";
import { TrackingShopCard } from "../../components/tracking/tracking-shop-card";
import { TrackingLoadingSkeleton } from "../../components/tracking/tracking-loading-skeleton";
import { TrackingErrorState } from "../../components/tracking/tracking-error-state";

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
      {/* Header with live refresh and home action */}
      <TrackingHeader
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        onNewOrder={startNewOrder}
      />

      {/* Main Container - ordered sequentially per spec */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 space-y-6">
        {/* 1. Compact Order Confirmation & Reference Card */}
        <OrderStatusBanner
          order={order}
          copied={copied}
          onCopyReference={copyOrderReference}
        />

        {/* 2. Combined Documents List & Payment Details Card */}
        <OrderDocumentsPaymentCard order={order} />

        {/* 3. Order Progress / Timeline Card */}
        <OrderTimeline steps={order.timeline} />

        {/* 4. Printing Shop Details Card */}
        <TrackingShopCard
          shop={order.shop}
          collectionInstructions={order.collectionInstructions}
        />
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
