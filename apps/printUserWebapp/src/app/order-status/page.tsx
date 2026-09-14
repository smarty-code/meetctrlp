"use client";

import React, { Suspense } from "react";
import { useOrderTracking } from "../../hooks/use-order-tracking";
import { TrackingHeader } from "../../components/tracking/tracking-header";
import { OrderStatusBanner } from "../../components/tracking/order-status-banner";
import { OrderTimeline } from "../../components/tracking/order-timeline";
import { OrderEstimateCard } from "../../components/tracking/order-estimate-card";
import { TrackingShopCard } from "../../components/tracking/tracking-shop-card";
import { TrackingPaymentCard } from "../../components/tracking/tracking-payment-card";
import { OrderCompactSummary } from "../../components/tracking/order-compact-summary";
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

  const isReadyOrComplete =
    order.status === "READY" || order.status === "COMPLETED";

  return (
    <div className="flex min-h-screen flex-col bg-paper text-charcoal">
      {/* Header with live refresh and home action */}
      <TrackingHeader
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        onNewOrder={startNewOrder}
      />

      {/* Main Container */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Primary Column (Order status banner, timeline, estimate) */}
          <div className="space-y-6 lg:col-span-7">
            <OrderStatusBanner
              order={order}
              copied={copied}
              onCopyReference={copyOrderReference}
            />

            <OrderTimeline steps={order.timeline} />

            {/* Estimated ready time card hidden for now per MVP requirement */}
            {/*
            <OrderEstimateCard
              estimatedTime={order.estimatedReadyTime}
              isReadyOrComplete={isReadyOrComplete}
            />
            */}
          </div>

          {/* Secondary Column (Shop info, payment, compact document summary) */}
          <div className="space-y-6 lg:col-span-5">
            <TrackingShopCard
              shop={order.shop}
              collectionInstructions={order.collectionInstructions}
            />

            <TrackingPaymentCard order={order} />

            <OrderCompactSummary summary={order.documentSummary} />
          </div>
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
