"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { useReviewOrder } from "../../hooks/use-review-order"
import { ReviewHeader } from "../../components/review/review-header"
import { ShopSummaryCard } from "../../components/review/shop-summary-card"
import { DocumentReviewList } from "../../components/review/document-review-list"
import { PriceSummaryCard } from "../../components/review/price-summary-card"
import { PriceChangedBanner } from "../../components/review/price-changed-banner"
import { ReviewOrderFooter } from "../../components/review/review-order-footer"
import { ReviewLoadingSkeleton } from "../../components/review/review-loading-skeleton"
import { ReviewErrorState } from "../../components/review/review-error-state"
import { PaymentMethodSelector } from "../../components/payment/payment-method-selector"
import { PaymentStatusFeedback } from "../../components/payment/payment-status-feedback"
import { REVIEW_ROUTES } from "../../data/review-constants"

export default function ReviewPage() {
  const router = useRouter()
  const {
    draft,
    isLoading,
    isValidating,
    isSubmitting,
    canSubmit,
    validationError,
    loadError,
    paymentError,
    priceNotice,
    selectedMethod,
    availableMethods,
    paymentState,
    setSelectedMethod,
    handleBack,
    handleEditDocument,
    handleUpdateCopies,
    handleDeleteDocument,
    handlePaymentSubmit,
    handlePaymentRetry,
    handleDismissPriceNotice,
    retry,
  } = useReviewOrder()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper text-charcoal">
        <ReviewHeader onBack={handleBack} />
        <main className="mx-auto w-full max-w-4xl py-4">
          <ReviewLoadingSkeleton />
        </main>
      </div>
    )
  }

  if (loadError || !draft) {
    return (
      <div className="min-h-screen bg-paper text-charcoal">
        <ReviewHeader onBack={handleBack} />
        <main className="mx-auto w-full max-w-4xl py-12">
          <ReviewErrorState onRetry={retry} />
        </main>
      </div>
    )
  }

  if (draft.documents.length === 0) {
    return (
      <div className="min-h-screen bg-paper text-charcoal">
        <ReviewHeader onBack={handleBack} />
        <main className="mx-auto w-full max-w-4xl py-12">
          <ReviewErrorState
            isEmpty
            onAddDocuments={() => router.push(REVIEW_ROUTES.HOME)}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-charcoal selection:bg-macaw-blue selection:text-paper">
      {/* 1. Established CtrlP Review Header */}
      <ReviewHeader onBack={handleBack} />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-4 pb-28 sm:px-6 sm:pb-12 md:py-6">
        {/* Validation Error Alert */}
        {validationError && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-3.5 text-body font-bold text-destructive animate-fadeIn"
          >
            <AlertCircle className="size-5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Price Changed Banner */}
        {priceNotice && (
          <div className="mb-4">
            <PriceChangedBanner
              previousTotal={priceNotice.previousTotal}
              newTotal={priceNotice.newTotal}
              onDismiss={handleDismissPriceNotice}
            />
          </div>
        )}

        {/* Responsive Grid: Mobile 1-col, Desktop 2-cols */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Shop Context & Documents List */}
          <div className="space-y-4 lg:col-span-7">
            {/* Shop Summary Card */}
            <ShopSummaryCard shop={draft.shop} />

            {/* Document Review List */}
            <DocumentReviewList
              documents={draft.documents}
              pricingItems={draft.pricing.items}
              onEditDocument={handleEditDocument}
              onUpdateCopies={handleUpdateCopies}
              onDeleteDocument={handleDeleteDocument}
            />
          </div>

          {/* Right Column: Price Summary, Payment Selection & Direct Checkout */}
          <div className="space-y-4 lg:col-span-5">
            <div className="sticky top-20 space-y-4">
              {/* Structured Data-Driven Price Summary */}
              <PriceSummaryCard
                pricing={draft.pricing}
                totalDocuments={draft.documents.length}
              />

              {/* Payment Method Selector */}
              <PaymentMethodSelector
                methods={availableMethods}
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
                disabled={isSubmitting}
              />

              {/* In-Flight & Failure Feedback */}
              <PaymentStatusFeedback
                paymentState={paymentState}
                errorMessage={paymentError}
                onRetry={handlePaymentRetry}
              />

              {/* Desktop CTA Action Box */}
              <div className="hidden sm:block">
                <ReviewOrderFooter
                  totalAmount={draft.pricing.total}
                  currency={draft.pricing.currency}
                  totalDocuments={draft.documents.length}
                  totalCopies={draft.pricing.totalCopies}
                  selectedMethod={selectedMethod}
                  paymentState={paymentState}
                  isValidating={isValidating}
                  isSubmitting={isSubmitting}
                  canContinue={canSubmit}
                  onContinue={handlePaymentSubmit}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="sm:hidden">
        <ReviewOrderFooter
          totalAmount={draft.pricing.total}
          currency={draft.pricing.currency}
          totalDocuments={draft.documents.length}
          totalCopies={draft.pricing.totalCopies}
          selectedMethod={selectedMethod}
          paymentState={paymentState}
          isValidating={isValidating}
          isSubmitting={isSubmitting}
          canContinue={canSubmit}
          onContinue={handlePaymentSubmit}
        />
      </div>
    </div>
  )
}

