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
  checkoutIdempotencyKey,
  getAvailablePaymentMethods,
  hasPlacedOrder,
  initiateOnlinePaymentTransaction,
  verifyPaymentTransaction,
  submitCashPaymentOrder,
  submitOnlinePaidOrder,
  getActiveTransaction,
  clearActiveTransaction,
} from "../data/payment-repository"
import { PAYMENT_COPY } from "../data/payment-constants"
import { useShopSession } from "../components/shop-session-provider"
import {
  deleteGuestDocument,
  loadGuestSession,
  quoteGuestSession,
  saveDocumentConfiguration,
} from "../lib/cloud"
import { removeCachedFile } from "../lib/file-store"
import { quoteToPricing, toApiColor, toApiOrientation, toApiPaper } from "../lib/print-user-map"

/** Review edits are priced once they pause this long (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 11.2). */
const QUOTE_DEBOUNCE_MS = 500

export function useReviewOrder() {
  const router = useRouter()
  const { routes } = useShopSession()
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

  // 1. Initial Load of Draft and Session Recovery. `fresh` reads the cart from the server again
  // (retry, or after a failed write) instead of reusing the one already held.
  const loadDraft = useCallback((options: { fresh?: boolean } = {}) => {
    loadOrderDraft(options)
      .then((loaded) => {
        if (!isMountedRef.current) return
        // An online order placed before a reload, with its payment unfinished: the cart is empty
        // now, and the order's own page is where it is paid or cancelled.
        const existingTx = getActiveTransaction()
        if (hasPlacedOrder(existingTx) && existingTx.state !== "SUCCESS" && loaded.documents.length === 0) {
          router.replace(`${routes.orderStatus}?orderId=${encodeURIComponent(existingTx.orderId)}`)
          return
        }
        if (existingTx) clearActiveTransaction()

        setDraft(loaded)
        setLoadError(null)
        setValidationError(null)
        setPaymentError(null)
        setPaymentState("METHOD_SELECTED")
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
  }, [router, routes.orderStatus])

  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    loadDraft()
    return () => {
      isMountedRef.current = false
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    }
  }, [loadDraft])

  const retry = useCallback(() => {
    setIsLoading(true)
    loadDraft({ fresh: true })
  }, [loadDraft])

  // Derive Available Payment Methods from Shop Context. Once an online order is placed and waiting
  // for its payment, cash is off: the cart is already in that order.
  const availableMethods = useMemo<PaymentMethodItem[]>(() => {
    if (!draft?.shop) return []
    const methods = getAvailablePaymentMethods(draft.shop)
    if (!hasPlacedOrder(activeTransaction)) return methods
    return methods.map((method) =>
      method.id === "CASH"
        ? { ...method, enabled: false, disabledReason: PAYMENT_COPY.onlineOrderPendingReason }
        : method
    )
  }, [draft, activeTransaction])

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
    router.push(routes.customize)
  }, [draft, router, routes.customize])

  const handleEditDocument = useCallback(
    (documentId: string) => {
      if (draft) {
        saveOrderDraft(draft)
      }
      router.push(`${routes.customize}?selectedId=${encodeURIComponent(documentId)}`)
    },
    [draft, router, routes.customize]
  )

  // Review edits must reach the server cart, which is what the order is built from. Writes are
  // chained so rapid +/- taps land in order, and submit waits for the chain to drain. The quote
  // runs once the edits pause (one quote for a burst of taps), or right away when submit needs it.
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve())
  const quoteDueRef = useRef(false)
  // Submit awaits the sync queue, then reads the draft from here: its closure would be stale.
  const draftRef = useRef<OrderDraft | null>(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  const activeTransactionRef = useRef<PaymentTransaction | null>(activeTransaction)
  useEffect(() => {
    activeTransactionRef.current = activeTransaction
  }, [activeTransaction])

  const handleSyncError = useCallback(
    (error: unknown) => {
      console.error("Failed to sync review changes:", error)
      if (!isMountedRef.current) return
      setValidationError("Could not save your change. Reloading your order.")
      loadDraft({ fresh: true })
    },
    [loadDraft]
  )

  const runQuote = useCallback(() => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    quoteTimerRef.current = null
    quoteDueRef.current = false
    syncQueueRef.current = syncQueueRef.current
      .then(quoteGuestSession)
      .then((quote) => {
        if (!isMountedRef.current) return
        const pricing = quoteToPricing(quote)
        if (draftRef.current) draftRef.current = { ...draftRef.current, pricing }
        setDraft((current) => (current ? { ...current, pricing } : current))
      })
      .catch(handleSyncError)
  }, [handleSyncError])

  const scheduleQuote = useCallback(() => {
    quoteDueRef.current = true
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current)
    quoteTimerRef.current = setTimeout(runQuote, QUOTE_DEBOUNCE_MS)
  }, [runQuote])

  const syncWithServer = useCallback(
    (write: () => Promise<unknown>) => {
      syncQueueRef.current = syncQueueRef.current
        .then(write)
        .then(scheduleQuote)
        .catch(handleSyncError)
    },
    [handleSyncError, scheduleQuote]
  )

  // Waits for queued edits, then prices them now rather than after the debounce.
  const settleEdits = useCallback(async () => {
    await syncQueueRef.current
    if (quoteDueRef.current) {
      runQuote()
      await syncQueueRef.current
    }
  }, [runQuote])

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

      const updated = updatedDocs.find((doc) => doc.id === documentId)
      if (!updated) return
      syncWithServer(() =>
        saveDocumentConfiguration(documentId, {
          colorMode: toApiColor(updated.configuration.colorMode),
          copies: clampedCopies,
          paperSize: toApiPaper(updated.configuration.paperSize),
          orientation: toApiOrientation(updated.configuration.orientation),
          pageSelection: {
            mode: updated.configuration.pageSelection.mode,
            expression: updated.configuration.pageSelection.expression,
          },
        })
      )
    },
    [draft, syncWithServer]
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
      // A failed delete reloads the order from the server cart, which brings the document back.
      syncWithServer(async () => {
        await deleteGuestDocument(documentId)
        void removeCachedFile(documentId)
      })
    },
    [draft, syncWithServer]
  )

  const handleDismissPriceNotice = useCallback(() => {
    setPriceNotice(null)
  }, [])

  // A payment that failed after its order was placed keeps that order: the retry pays it, rather
  // than submitting again against the cart the order already emptied.
  const handlePaymentRetry = useCallback(() => {
    if (!hasPlacedOrder(activeTransactionRef.current)) {
      clearActiveTransaction()
      setActiveTransaction(null)
    }
    setPaymentError(null)
    setPaymentState("METHOD_SELECTED")
  }, [])

  // After a submit failed with no answer, the order may still have been placed (a lost response).
  // An empty cart with a latest order means it was: show that order instead of an error.
  const openPlacedOrderIfAny = useCallback(async () => {
    const session = await loadGuestSession({ fresh: true }).catch(() => null)
    const cartEmpty = session?.documents.every((document) => document.status !== "READY") ?? false
    if (!session?.activeOrderId || !cartEmpty || !isMountedRef.current) return false
    router.push(`${routes.orderStatus}?orderId=${encodeURIComponent(session.activeOrderId)}`)
    return true
  }, [router, routes.orderStatus])

  const handlePaymentSubmit = useCallback(async () => {
    if (!draftRef.current || isSubmittingRef.current || isValidating) return

    // Let pending copy/delete edits reach the server, and be priced, before prices are compared.
    isSubmittingRef.current = true
    await settleEdits()
    isSubmittingRef.current = false
    const draft = draftRef.current
    if (!draft || !isMountedRef.current) return

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
      const idempotencyKey = checkoutIdempotencyKey(draft, selectedMethod)
      const placedTransaction = activeTransactionRef.current

      if (selectedMethod === "ONLINE") {
        setPaymentState("INITIATING")

        // 1. Authoritative price verification & transaction initiation, unless the order is
        // already placed and only its payment is being retried.
        const initResult = hasPlacedOrder(placedTransaction)
          ? {
              priceChanged: false,
              authoritativeTotal: placedTransaction.amount,
              transaction: placedTransaction,
            }
          : await initiateOnlinePaymentTransaction(draft, idempotencyKey)

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
                `${routes.orderStatus}?orderId=${encodeURIComponent(
                  verifyResult.verifiedTransaction.orderId
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

        const submitted = await submitCashPaymentOrder(draft, idempotencyKey)

        if (!isMountedRef.current) return

        setPaymentState("SUCCESS")

        setTimeout(() => {
          if (isMountedRef.current) {
            router.push(
              `${routes.orderStatus}?orderId=${encodeURIComponent(
                submitted.orderId
              )}`
            )
          }
        }, 500)
      }
    } catch (err) {
      if (!isMountedRef.current) return
      console.error("Payment transaction error:", err)
      if (await openPlacedOrderIfAny()) return
      setPaymentState("FAILED")
      setPaymentError(PAYMENT_COPY.paymentFailedDescription)
    } finally {
      if (isMountedRef.current) {
        isSubmittingRef.current = false
        setIsSubmitting(false)
      }
    }
  }, [isValidating, selectedMethod, router, routes.orderStatus, settleEdits, openPlacedOrderIfAny])

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

