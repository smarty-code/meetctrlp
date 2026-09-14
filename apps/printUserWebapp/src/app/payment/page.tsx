"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { usePayment } from "../../hooks/use-payment"
import { PaymentHeader } from "../../components/payment/payment-header"
import { PaymentOrderSummary } from "../../components/payment/payment-order-summary"
import { PaymentMethodSelector } from "../../components/payment/payment-method-selector"
import { PaymentStatusFeedback } from "../../components/payment/payment-status-feedback"
import { PaymentActionFooter } from "../../components/payment/payment-action-footer"
import { PaymentLoadingSkeleton } from "../../components/payment/payment-loading-skeleton"
import { PaymentErrorState } from "../../components/payment/payment-error-state"
import { PAYMENT_ROUTES } from "../../data/payment-constants"

export default function PaymentPage() {
  const router = useRouter()
  const {
    draft,
    isLoading,
    isSubmitting,
    selectedMethod,
    availableMethods,
    paymentState,
    errorMessage,
    priceNotice,
    setSelectedMethod,
    handlePaymentSubmit,
    handleRetry,
    handleBack,
    handleDismissPriceNotice,
    canSubmit,
  } = usePayment()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper text-charcoal">
        <PaymentHeader onBack={handleBack} />
        <main className="mx-auto w-full max-w-lg py-6">
          <PaymentLoadingSkeleton />
        </main>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-paper text-charcoal">
        <PaymentHeader onBack={handleBack} />
        <main className="mx-auto w-full max-w-lg py-12">
          <PaymentErrorState
            isEmpty
            onBackToReview={() => router.push(PAYMENT_ROUTES.REVIEW)}
            onReturnHome={() => router.push(PAYMENT_ROUTES.HOME)}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-charcoal selection:bg-macaw-blue selection:text-paper">
      {/* 1. Established CtrlP Header */}
      <PaymentHeader onBack={handleBack} />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-28 sm:px-6 sm:pb-8">
        <div className="space-y-6">
          {/* Order Summary & Prominent Amount Due */}
          <PaymentOrderSummary
            orderId={draft.orderId}
            shop={draft.shop}
            totalAmount={draft.pricing.total}
            totalDocuments={draft.documents.length}
            totalCopies={draft.pricing.totalCopies}
            currency={draft.pricing.currency}
          />

          {/* Dynamic Status Feedback (Loading, Pending, Verification, Errors, Price Notice) */}
          <PaymentStatusFeedback
            paymentState={paymentState}
            errorMessage={errorMessage}
            priceNotice={priceNotice}
            onRetry={handleRetry}
            onDismissPriceNotice={handleDismissPriceNotice}
          />

          {/* Payment Method Selector */}
          <PaymentMethodSelector
            methods={availableMethods}
            selectedMethod={selectedMethod}
            onSelectMethod={setSelectedMethod}
            disabled={isSubmitting}
          />

          {/* Desktop/Tablet Action Container */}
          <div className="hidden sm:block">
            <PaymentActionFooter
              totalAmount={draft.pricing.total}
              currency={draft.pricing.currency}
              selectedMethod={selectedMethod}
              paymentState={paymentState}
              isSubmitting={isSubmitting}
              canSubmit={canSubmit}
              onSubmit={handlePaymentSubmit}
            />
          </div>
        </div>
      </main>

      {/* Mobile Sticky Action Footer */}
      <div className="sm:hidden">
        <PaymentActionFooter
          totalAmount={draft.pricing.total}
          currency={draft.pricing.currency}
          selectedMethod={selectedMethod}
          paymentState={paymentState}
          isSubmitting={isSubmitting}
          canSubmit={canSubmit}
          onSubmit={handlePaymentSubmit}
        />
      </div>
    </div>
  )
}
