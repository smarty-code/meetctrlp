"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { OrderDraft } from "../types/order"
import {
  loadOrderDraft,
  refreshPriceAuthoritatively,
  saveOrderDraft,
  validateOrderDraft,
} from "../data/order-repository"
import { REVIEW_ROUTES } from "../data/review-constants"

export function useReviewOrder() {
  const router = useRouter()
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [priceNotice, setPriceNotice] = useState<{
    previousTotal: number
    newTotal: number
  } | null>(null)

  const fetchDraft = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setValidationError(null)

    try {
      const loaded = await loadOrderDraft()
      setDraft(loaded)
    } catch (err) {
      console.error("Failed to load order draft:", err)
      setLoadError("Unable to retrieve your order details.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDraft()
  }, [fetchDraft])

  const handleBack = useCallback(() => {
    if (draft) {
      saveOrderDraft(draft)
    }
    router.push(REVIEW_ROUTES.CUSTOMIZE)
  }, [draft, router])

  const handleEditDocument = useCallback(
    (documentId: string) => {
      if (draft) {
        saveOrderDraft(draft)
      }
      router.push(`${REVIEW_ROUTES.CUSTOMIZE}?selectedId=${encodeURIComponent(documentId)}`)
    },
    [draft, router]
  )

  const handleDismissPriceNotice = useCallback(() => {
    setPriceNotice(null)
  }, [])

  const handleProceedToPayment = useCallback(async () => {
    if (!draft || isSubmitting || isValidating) return

    setValidationError(null)

    // 1. Client pre-validation
    const validation = validateOrderDraft(draft)
    if (!validation.isValid) {
      setValidationError(validation.errors[0] || "Invalid order configuration.")
      return
    }

    setIsValidating(true)

    try {
      // 2. Authoritative price refresh & validation
      const refreshResult = await refreshPriceAuthoritatively(draft)

      if (refreshResult.hasChanged) {
        const updatedDraft: OrderDraft = {
          ...draft,
          pricing: refreshResult.pricing,
          metadata: {
            ...draft.metadata,
            updatedAt: new Date().toISOString(),
          },
        }
        setDraft(updatedDraft)
        saveOrderDraft(updatedDraft)
        setPriceNotice({
          previousTotal: refreshResult.previousTotal,
          newTotal: refreshResult.pricing.total,
        })
        setIsValidating(false)
        return
      }

      // 3. Price confirmed -> proceed to Screen 04
      setIsSubmitting(true)
      saveOrderDraft(draft)
      router.push(REVIEW_ROUTES.PAYMENT)
    } catch (err) {
      console.error("Price verification failed:", err)
      setValidationError("Could not verify the current order price. Please try again.")
      setIsValidating(false)
    }
  }, [draft, isSubmitting, isValidating, router])

  const canContinue =
    Boolean(draft && draft.documents.length > 0) &&
    !isLoading &&
    !isValidating &&
    !isSubmitting

  return {
    draft,
    isLoading,
    isValidating,
    isSubmitting,
    canContinue,
    validationError,
    loadError,
    priceNotice,
    handleBack,
    handleEditDocument,
    handleProceedToPayment,
    handleDismissPriceNotice,
    retry: fetchDraft,
  }
}
