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

import { WaitingForShopBanner } from "../../components/tracking/waiting-for-shop-banner";
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

  const isWaitingForShop =
    order.status === "SUBMITTED" || order.status === "ACCEPTED";

  return (
    <div className="flex min-h-screen flex-col bg-paper text-charcoal">
      {/* Header with live refresh and home action */}
      <TrackingHeader
        isRefreshing={isRefreshing}
        onRefresh={refresh}
        onNewOrder={startNewOrder}
      />

      {/* Main Container - Mobile First vertical, Desktop 2-column per Screen 06 spec */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Primary Column: Status Confirmation, Waiting State, & Progress Timeline */}
          <div className="space-y-6 lg:col-span-7">
            {/* 1. Compact Order Confirmation & Reference Card */}
            <OrderStatusBanner
              order={order}
              copied={copied}
              onCopyReference={copyOrderReference}
            />

            {/* 2. Reassurance / Current State Callout (Screen 06 Waiting for Shop) */}
            {isWaitingForShop && (
              <WaitingForShopBanner
                estimatedReadyTime={order.estimatedReadyTime}
                estimatedMinutes={order.shop.estimatedMinutes}
              />
            )}

            {/* 3. Order Progress / Timeline Card */}
            <OrderTimeline steps={order.timeline} />
          </div>

          {/* Secondary Column: Shop Context & Order/Payment Details */}
          <div className="space-y-6 lg:col-span-5">
            {/* 4. Printing Shop Details Card */}
            <TrackingShopCard
              shop={order.shop}
              collectionInstructions={order.collectionInstructions}
            />

            {/* 5. Combined Documents List & Payment Details Card */}
            <OrderDocumentsPaymentCard order={order} />
          </div>
        </div>
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
