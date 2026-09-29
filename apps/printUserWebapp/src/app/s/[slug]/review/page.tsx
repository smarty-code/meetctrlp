"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { useReviewOrder } from "../../../../hooks/use-review-order"
import { ReviewHeader } from "../../../../components/review/review-header"
import { ShopSummaryCard } from "../../../../components/review/shop-summary-card"
import { DocumentReviewList } from "../../../../components/review/document-review-list"
import { PriceSummaryCard } from "../../../../components/review/price-summary-card"
import { PriceChangedBanner } from "../../../../components/review/price-changed-banner"
import { ReviewOrderFooter } from "../../../../components/review/review-order-footer"
import { ReviewLoadingSkeleton } from "../../../../components/review/review-loading-skeleton"
import { ReviewErrorState } from "../../../../components/review/review-error-state"
import { PaymentMethodDrawer } from "../../../../components/payment/payment-method-drawer"
import { PaymentStatusFeedback } from "../../../../components/payment/payment-status-feedback"
import { useShopSession } from "../../../../components/shop-session-provider"

export default function ReviewPage() {
  const router = useRouter()
  const { routes } = useShopSession()
  const [isMethodDrawerOpen, setIsMethodDrawerOpen] = useState(false)
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
          <ReviewErrorState isEmpty onAddDocuments={() => router.push(routes.home)} />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper text-charcoal selection:bg-macaw-blue selection:text-paper">
      <ReviewHeader onBack={handleBack} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-4 pb-28 sm:px-6 sm:pb-12 md:py-6">
        {validationError && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-3 rounded-xl border-2 border-destructive bg-destructive/10 p-3.5 text-body font-bold text-destructive animate-fadeIn"
          >
            <AlertCircle className="size-5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
        {priceNotice && (
          <div className="mb-4">
            <PriceChangedBanner
              previousTotal={priceNotice.previousTotal}
              newTotal={priceNotice.newTotal}
              onDismiss={handleDismissPriceNotice}
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-4 lg:col-span-7">
            <ShopSummaryCard shop={draft.shop} />
            <DocumentReviewList
              documents={draft.documents}
              pricingItems={draft.pricing.items}
              onEditDocument={handleEditDocument}
              onUpdateCopies={handleUpdateCopies}
              onDeleteDocument={handleDeleteDocument}
            />
          </div>
          <div className="space-y-4 lg:col-span-5">
            <div className="sticky top-20 space-y-4">
              <PriceSummaryCard pricing={draft.pricing} totalDocuments={draft.documents.length} />
              <PaymentStatusFeedback
                paymentState={paymentState}
                errorMessage={paymentError}
                onRetry={handlePaymentRetry}
              />
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
                  onChangeMethod={() => setIsMethodDrawerOpen(true)}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
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
          onChangeMethod={() => setIsMethodDrawerOpen(true)}
        />
      </div>
      <PaymentMethodDrawer
        isOpen={isMethodDrawerOpen}
        onClose={() => setIsMethodDrawerOpen(false)}
        methods={availableMethods}
        selectedMethod={selectedMethod}
        onSelectMethod={setSelectedMethod}
        disabled={isSubmitting}
      />
    </div>
  )
}
