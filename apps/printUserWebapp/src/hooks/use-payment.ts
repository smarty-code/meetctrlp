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
import { loadOrderDraft, validateOrderDraft } from "../data/order-repository"
import {
  getAvailablePaymentMethods,
  initiateOnlinePaymentTransaction,
  verifyPaymentTransaction,
  submitCashPaymentOrder,
  submitOnlinePaidOrder,
  getActiveTransaction,
  clearActiveTransaction,
} from "../data/payment-repository"
import { PAYMENT_COPY, PAYMENT_ROUTES } from "../data/payment-constants"

export interface UsePaymentReturn {
  draft: OrderDraft | null
  isLoading: boolean
  isSubmitting: boolean
  selectedMethod: PaymentMethodId
  availableMethods: PaymentMethodItem[]
  paymentState: PaymentState
  activeTransaction: PaymentTransaction | null
  errorMessage: string | null
  priceNotice: {
    previousTotal: number
    newTotal: number
  } | null
  setSelectedMethod: (method: PaymentMethodId) => void
  handlePaymentSubmit: () => Promise<void>
  handleRetry: () => void
  handleBack: () => void
  handleDismissPriceNotice: () => void
  canSubmit: boolean
}

export function usePayment(): UsePaymentReturn {
  const router = useRouter()
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userSelectedMethod, setUserSelectedMethod] =
    useState<PaymentMethodId | null>(null)
  const [paymentState, setPaymentState] = useState<PaymentState>("NOT_STARTED")
  const [activeTransaction, setActiveTransaction] =
    useState<PaymentTransaction | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [priceNotice, setPriceNotice] = useState<{
    previousTotal: number
    newTotal: number
  } | null>(null)

  const isMountedRef = useRef(true)
  const isSubmittingRef = useRef(false)

  // 1. Initial Load of Draft and Session Recovery
  useEffect(() => {
    isMountedRef.current = true

    loadOrderDraft()
      .then((loaded) => {
        if (!isMountedRef.current) return
        setDraft(loaded)

        // Check if there was an in-flight transaction saved
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
        console.error("Failed loading order draft for payment:", err)
        setErrorMessage(PAYMENT_COPY.errorLoadingOrder)
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

  // 2. Derive Available Methods from Shop Context
  const availableMethods = useMemo(() => {
    if (!draft?.shop) return []
    return getAvailablePaymentMethods(draft.shop)
  }, [draft])

  // Derive active selected payment method without triggering effect re-renders
  const selectedMethod = useMemo<PaymentMethodId>(() => {
    if (userSelectedMethod) {
      const match = availableMethods.find(
        (m) => m.id === userSelectedMethod && m.enabled
      )
      if (match) return userSelectedMethod
    }
    const firstEnabled = availableMethods.find((m) => m.enabled)
    return firstEnabled ? firstEnabled.id : "ONLINE"
  }, [userSelectedMethod, availableMethods])

  // 3. Primary Payment Submission Handler
  const handlePaymentSubmit = useCallback(async () => {
    if (!draft || isSubmittingRef.current) return

    // Validate draft
    const validation = validateOrderDraft(draft)
    if (!validation.isValid) {
      setErrorMessage(
        validation.errors[0] || "Order details are invalid. Please return to review."
      )
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const idempotencyKey = `idemp_pay_${draft.orderId}_${Date.now()}`

      if (selectedMethod === "ONLINE") {
        setPaymentState("INITIATING")

        // 1. Authoritative price validation & initiation
        const initResult = await initiateOnlinePaymentTransaction(
          draft,
          idempotencyKey
        )

        if (!isMountedRef.current) return

        if (initResult.priceChanged) {
          setPriceNotice({
            previousTotal: draft.pricing.total,
            newTotal: initResult.authoritativeTotal,
          })
          setPaymentState("FAILED")
          setErrorMessage(PAYMENT_COPY.priceChangedDescription)
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

          // 3. Order placed in backend
          await submitOnlinePaidOrder(draft, verifyResult.verifiedTransaction)

          // Short delay for visual confirmation before navigating to Screen 05
          setTimeout(() => {
            if (isMountedRef.current) {
              router.push(
                `${PAYMENT_ROUTES.ORDER_STATUS}?orderId=${encodeURIComponent(
                  draft.orderId
                )}`
              )
            }
          }, 500)
        } else {
          setPaymentState("FAILED")
          setErrorMessage(PAYMENT_COPY.paymentFailedDescription)
        }
      } else if (selectedMethod === "CASH") {
        setPaymentState("CASH_PENDING")

        await submitCashPaymentOrder(draft, idempotencyKey)

        if (!isMountedRef.current) return

        setPaymentState("SUCCESS")

        setTimeout(() => {
          if (isMountedRef.current) {
            router.push(
              `${PAYMENT_ROUTES.ORDER_STATUS}?orderId=${encodeURIComponent(
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
      setErrorMessage(PAYMENT_COPY.paymentFailedDescription)
    } finally {
      if (isMountedRef.current) {
        isSubmittingRef.current = false
        setIsSubmitting(false)
      }
    }
  }, [draft, selectedMethod, router])

  // 4. Retry Handler
  const handleRetry = useCallback(() => {
    clearActiveTransaction()
    setActiveTransaction(null)
    setErrorMessage(null)
    setPaymentState("METHOD_SELECTED")
  }, [])

  // 5. Back Handler (with in-progress safety confirmation)
  const handleBack = useCallback(() => {
    if (
      paymentState === "INITIATING" ||
      paymentState === "VERIFICATION_PENDING"
    ) {
      const confirmLeave = window.confirm(PAYMENT_COPY.backConfirmInFlight)
      if (!confirmLeave) return
    }
    router.push(PAYMENT_ROUTES.REVIEW)
  }, [paymentState, router])

  // 6. Price Notice Dismiss
  const handleDismissPriceNotice = useCallback(() => {
    setPriceNotice(null)
    router.push(PAYMENT_ROUTES.REVIEW)
  }, [router])

  // Compute if primary button can be clicked
  const canSubmit = useMemo(() => {
    if (isLoading || isSubmitting) return false
    if (
      paymentState === "INITIATING" ||
      paymentState === "VERIFICATION_PENDING" ||
      paymentState === "SUCCESS"
    ) {
      return false
    }
    const currentMethodObj = availableMethods.find(
      (m) => m.id === selectedMethod
    )
    return Boolean(currentMethodObj?.enabled)
  }, [isLoading, isSubmitting, paymentState, availableMethods, selectedMethod])

  return {
    draft,
    isLoading,
    isSubmitting,
    selectedMethod,
    availableMethods,
    paymentState,
    activeTransaction,
    errorMessage,
    priceNotice,
    setSelectedMethod: setUserSelectedMethod,
    handlePaymentSubmit,
    handleRetry,
    handleBack,
    handleDismissPriceNotice,
    canSubmit,
  }
}
