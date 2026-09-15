"use client";

import React, { Suspense } from "react";
import { useOrderTracking } from "../../hooks/use-order-tracking";
import { TrackingHeader } from "../../components/tracking/tracking-header";
import { OrderDocumentsPaymentCard } from "../../components/tracking/order-documents-payment-card";
import { OrderTimeline } from "../../components/tracking/order-timeline";
import { TrackingShopCard } from "../../components/tracking/tracking-shop-card";
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
      {/* Header with direct status title, order reference ID, live refresh, and home action */}
      <TrackingHeader
        order={order}
        copied={copied}
        onCopyReference={copyOrderReference}
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        onNewOrder={startNewOrder}
      />

      {/* Main Container - ordered sequentially per prioritized requirement */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 sm:px-6 space-y-4">
        {/* 1. Order Progress Card (compact timeline) */}
        <OrderTimeline steps={order.timeline} />

        {/* 2. Order Details & Payment Card (all ordered documents one by one + payment status/amount) */}
        <OrderDocumentsPaymentCard order={order} />

        {/* 3. Printing At Card (shop name, location, pickup instructions) */}
        <TrackingShopCard
          shop={order.shop}
          collectionInstructions={order.collectionInstructions}
        />
      </main>

      {/* Status Transition Simulator (for verifying Screen 06 -> Screen 07 -> Screen 08) */}
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
