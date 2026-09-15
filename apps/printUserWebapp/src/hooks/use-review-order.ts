"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { OrderDraft } from "../types/order"
import {
  PaymentMethodId,
  PaymentMethodItem,
  PaymentState,
  PaymentTransaction,
} from "../types/payment"
import {
  calculateOrderPricing,
  loadOrderDraft,
  saveOrderDraft,
  validateOrderDraft,
} from "../data/order-repository"
import {
  getAvailablePaymentMethods,
  initiateOnlinePaymentTransaction,
  verifyPaymentTransaction,
  submitCashPaymentOrder,
  submitOnlinePaidOrder,
  getActiveTransaction,
  clearActiveTransaction,
} from "../data/payment-repository"
import { PAYMENT_COPY } from "../data/payment-constants"
import { REVIEW_ROUTES } from "../data/review-constants"

export function useReviewOrder() {
  const router = useRouter()
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isValidating = false
  const [validationError, setValidationError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [userSelectedMethod, setUserSelectedMethod] =
    useState<PaymentMethodId | null>(null)
  const [paymentState, setPaymentState] = useState<PaymentState>("NOT_STARTED")
  const [activeTransaction, setActiveTransaction] =
    useState<PaymentTransaction | null>(null)
  const [priceNotice, setPriceNotice] = useState<{
    previousTotal: number
    newTotal: number
  } | null>(null)

  const isMountedRef = useRef(true)
  const isSubmittingRef = useRef(false)

  // 1. Initial Load of Draft and Session Recovery
  const loadDraft = useCallback(() => {
    loadOrderDraft()
      .then((loaded) => {
        if (!isMountedRef.current) return
        setDraft(loaded)
        setLoadError(null)
        setValidationError(null)
        setPaymentError(null)

        // Restore existing in-flight transaction if matching order ID
        const existingTx = getActiveTransaction()
        if (existingTx && existingTx.orderId === loaded.orderId) {
          setActiveTransaction(existingTx)
          setPaymentState(existingTx.state)
          setUserSelectedMethod(existingTx.method)
        } else {
          setPaymentState("METHOD_SELECTED")
        }
      })
      .catch((err) => {
        if (!isMountedRef.current) return
        console.error("Failed to load order draft:", err)
        setLoadError("Unable to retrieve your order details.")
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      })
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    loadOrderDraft()
      .then((loaded) => {
        if (!isMountedRef.current) return
        setDraft(loaded)
        setLoadError(null)
        setValidationError(null)
        setPaymentError(null)

        // Restore existing in-flight transaction if matching order ID
        const existingTx = getActiveTransaction()
        if (existingTx && existingTx.orderId === loaded.orderId) {
          setActiveTransaction(existingTx)
          setPaymentState(existingTx.state)
          setUserSelectedMethod(existingTx.method)
        } else {
          setPaymentState("METHOD_SELECTED")
        }
      })
      .catch((err) => {
        if (!isMountedRef.current) return
        console.error("Failed to load order draft:", err)
        setLoadError("Unable to retrieve your order details.")
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      })

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const retry = useCallback(() => {
    setIsLoading(true)
    loadDraft()
  }, [loadDraft])

  // Derive Available Payment Methods from Shop Context
  const availableMethods = useMemo<PaymentMethodItem[]>(() => {
    if (!draft?.shop) return []
    return getAvailablePaymentMethods(draft.shop)
  }, [draft])

  // Derive active selected payment method safely
  const selectedMethod = useMemo<PaymentMethodId>(() => {
    if (userSelectedMethod) {
      const match = availableMethods.find(
        (m) => m.id === userSelectedMethod && m.enabled
      )
      if (match) return userSelectedMethod
    }
    // Default to UPI / ONLINE if enabled, otherwise first enabled
    const upiMethod = availableMethods.find(
      (m) => m.id === "ONLINE" && m.enabled
    )
    if (upiMethod) return "ONLINE"
    const firstEnabled = availableMethods.find((m) => m.enabled)
    return firstEnabled ? firstEnabled.id : "ONLINE"
  }, [userSelectedMethod, availableMethods])

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

  const handleUpdateCopies = useCallback(
    (documentId: string, newCopies: number) => {
      if (!draft) return
      const clampedCopies = Math.max(1, newCopies)
      const updatedDocs = draft.documents.map((doc) => {
        if (doc.id !== documentId) return doc
        return {
          ...doc,
          configuration: {
            ...doc.configuration,
            copies: clampedCopies,
          },
        }
      })
      const newPricing = calculateOrderPricing(updatedDocs, draft.shop)
      const updatedDraft: OrderDraft = {
        ...draft,
        documents: updatedDocs,
        pricing: newPricing,
        metadata: {
          ...draft.metadata,
          updatedAt: new Date().toISOString(),
        },
      }
      setDraft(updatedDraft)
      saveOrderDraft(updatedDraft)
    },
    [draft]
  )

  const handleDeleteDocument = useCallback(
    (documentId: string) => {
      if (!draft) return
      const updatedDocs = draft.documents.filter((doc) => doc.id !== documentId)
      const newPricing = calculateOrderPricing(updatedDocs, draft.shop)
      const updatedDraft: OrderDraft = {
        ...draft,
        documents: updatedDocs,
        pricing: newPricing,
        metadata: {
          ...draft.metadata,
          updatedAt: new Date().toISOString(),
        },
      }
      setDraft(updatedDraft)
      saveOrderDraft(updatedDraft)
    },
    [draft]
  )

  const handleDismissPriceNotice = useCallback(() => {
    setPriceNotice(null)
  }, [])

  const handlePaymentRetry = useCallback(() => {
    clearActiveTransaction()
    setActiveTransaction(null)
    setPaymentError(null)
    setPaymentState("METHOD_SELECTED")
  }, [])

  const handlePaymentSubmit = useCallback(async () => {
    if (!draft || isSubmittingRef.current || isValidating) return

    setValidationError(null)
    setPaymentError(null)

    // 1. Client pre-validation
    const validation = validateOrderDraft(draft)
    if (!validation.isValid) {
      setValidationError(validation.errors[0] || "Invalid order configuration.")
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const idempotencyKey = `idemp_pay_${draft.orderId}_${Date.now()}`

      if (selectedMethod === "ONLINE") {
        setPaymentState("INITIATING")

        // 1. Authoritative price verification & transaction initiation
        const initResult = await initiateOnlinePaymentTransaction(
          draft,
          idempotencyKey
        )

        if (!isMountedRef.current) return

        if (initResult.priceChanged) {
          const updatedDraft: OrderDraft = {
            ...draft,
            pricing: {
              ...draft.pricing,
              total: initResult.authoritativeTotal,
            },
            metadata: {
              ...draft.metadata,
              updatedAt: new Date().toISOString(),
            },
          }
          setDraft(updatedDraft)
          saveOrderDraft(updatedDraft)
          setPriceNotice({
            previousTotal: draft.pricing.total,
            newTotal: initResult.authoritativeTotal,
          })
          setPaymentState("FAILED")
          setPaymentError(PAYMENT_COPY.priceChangedDescription)
          isSubmittingRef.current = false
          setIsSubmitting(false)
          return
        }

        setActiveTransaction(initResult.transaction)
        setPaymentState("VERIFICATION_PENDING")

        // 2. Gateway verification roundtrip
        const verifyResult = await verifyPaymentTransaction(
          initResult.transaction
        )

        if (!isMountedRef.current) return

        if (verifyResult.success) {
          setActiveTransaction(verifyResult.verifiedTransaction)
          setPaymentState("SUCCESS")

          // 3. Persist order
          await submitOnlinePaidOrder(draft, verifyResult.verifiedTransaction)

          setTimeout(() => {
            if (isMountedRef.current) {
              router.push(
                `${REVIEW_ROUTES.ORDER_STATUS}?orderId=${encodeURIComponent(
                  draft.orderId
                )}`
              )
            }
          }, 500)
        } else {
          setPaymentState("FAILED")
          setPaymentError(PAYMENT_COPY.paymentFailedDescription)
        }
      } else if (selectedMethod === "CASH") {
        setPaymentState("CASH_PENDING")

        await submitCashPaymentOrder(draft, idempotencyKey)

        if (!isMountedRef.current) return

        setPaymentState("SUCCESS")

        setTimeout(() => {
          if (isMountedRef.current) {
            router.push(
              `${REVIEW_ROUTES.ORDER_STATUS}?orderId=${encodeURIComponent(
                draft.orderId
              )}`
            )
          }
        }, 500)
      }
    } catch (err) {
      if (!isMountedRef.current) return
      console.error("Payment transaction error:", err)
      setPaymentState("FAILED")
      setPaymentError(PAYMENT_COPY.paymentFailedDescription)
    } finally {
      if (isMountedRef.current) {
        isSubmittingRef.current = false
        setIsSubmitting(false)
      }
    }
  }, [draft, isValidating, selectedMethod, router])

  const canSubmit = useMemo(() => {
    if (
      isLoading ||
      isSubmitting ||
      isValidating ||
      !draft ||
      draft.documents.length === 0
    ) {
      return false
    }
    if (
      paymentState === "INITIATING" ||
      paymentState === "VERIFICATION_PENDING" ||
      paymentState === "SUCCESS"
    ) {
      return false
    }
    const currentMethodObj = availableMethods.find((m) => m.id === selectedMethod)
    return Boolean(currentMethodObj?.enabled)
  }, [
    isLoading,
    isSubmitting,
    isValidating,
    draft,
    paymentState,
    availableMethods,
    selectedMethod,
  ])

  return {
    draft,
    isLoading,
    isValidating,
    isSubmitting,
    canContinue: canSubmit,
    canSubmit,
    validationError,
    loadError,
    paymentError,
    priceNotice,
    selectedMethod,
    availableMethods,
    paymentState,
    activeTransaction,
    setSelectedMethod: setUserSelectedMethod,
    handleBack,
    handleEditDocument,
    handleUpdateCopies,
    handleDeleteDocument,
    handleProceedToPayment: handlePaymentSubmit,
    handlePaymentSubmit,
    handlePaymentRetry,
    handleDismissPriceNotice,
    retry,
  }
}

