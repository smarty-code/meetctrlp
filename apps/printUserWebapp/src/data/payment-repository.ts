import { ShopContext } from "../types/upload"
import { OrderDraft } from "../types/order"
import {
  PaymentMethodItem,
  PaymentTransaction,
  SubmittedOrder,
} from "../types/payment"
import { PAYMENT_COPY, PAYMENT_STORAGE_KEYS } from "./payment-constants"
import { quoteGuestSession, mockConfirmPayment, submitGuestOrder } from "../lib/cloud"
import { quoteToPricing } from "../lib/print-user-map"

/**
 * Returns available payment methods dynamically based on shop context and platform rules.
 */
export function getAvailablePaymentMethods(
  shop: ShopContext
): PaymentMethodItem[] {
  const methods: PaymentMethodItem[] = [
    {
      id: "ONLINE",
      title: PAYMENT_COPY.onlineMethodTitle,
      description: PAYMENT_COPY.onlineMethodDescription,
      iconName: "upi",
      enabled: shop.acceptsOnline !== false,
      badgeText: PAYMENT_COPY.onlineMethodBadge,
    },
    {
      id: "CASH",
      title: PAYMENT_COPY.cashMethodTitle,
      description: PAYMENT_COPY.cashMethodDescription,
      iconName: "cash",
      enabled: shop.acceptsCash !== false && (shop.status === "OPEN" || shop.status === "BUSY"),
      disabledReason:
        shop.status !== "OPEN" && shop.status !== "BUSY"
          ? "Cash payments unavailable while shop is offline"
          : undefined,
      badgeText: PAYMENT_COPY.cashMethodBadge,
    },
  ]

  return methods
}

/**
 * Initiates an online payment transaction after authoritative price verification.
 */
export async function initiateOnlinePaymentTransaction(
  order: OrderDraft,
  idempotencyKey: string
): Promise<{
  transaction: PaymentTransaction
  priceChanged: boolean
  authoritativeTotal: number
  submittedOrderId?: string
}> {
  const quote = await quoteGuestSession()
  const authoritativeTotal = quote.totalPaise / 100
  if (Math.abs(authoritativeTotal - order.pricing.total) > 0.009) {
    return {
      transaction: {
        transactionId: `TXN-ERR-${Date.now().toString(36).toUpperCase()}`,
        orderId: order.orderId,
        amount: authoritativeTotal,
        currency: quote.currency,
        method: "ONLINE",
        state: "FAILED",
        initiatedAt: new Date().toISOString(),
        idempotencyKey,
        errorMessage: PAYMENT_COPY.priceChangedDescription,
      },
      priceChanged: true,
      authoritativeTotal,
    }
  }

  const result = await submitGuestOrder({
    paymentMethod: "ONLINE",
    idempotencyKey,
    expectedTotalPaise: quote.totalPaise,
  })

  if (result.priceChanged || !result.order) {
    const nextTotal = quoteToPricing(result.quote).total
    return {
      transaction: {
        transactionId: `TXN-ERR-${Date.now().toString(36).toUpperCase()}`,
        orderId: order.orderId,
        amount: nextTotal,
        currency: result.quote.currency,
        method: "ONLINE",
        state: "FAILED",
        initiatedAt: new Date().toISOString(),
        idempotencyKey,
        errorMessage: PAYMENT_COPY.priceChangedDescription,
      },
      priceChanged: true,
      authoritativeTotal: nextTotal,
    }
  }

  const transaction: PaymentTransaction = {
    transactionId: `TXN-${result.order.id.slice(0, 8).toUpperCase()}`,
    orderId: result.order.id,
    amount: authoritativeTotal,
    currency: quote.currency,
    method: "ONLINE",
    state: "VERIFICATION_PENDING",
    initiatedAt: new Date().toISOString(),
    providerReference: result.order.id,
    idempotencyKey,
  }
  saveActiveTransaction(transaction)
  return {
    transaction,
    priceChanged: false,
    authoritativeTotal,
    submittedOrderId: result.order.id,
  }
}

export async function verifyPaymentTransaction(
  transaction: PaymentTransaction
): Promise<{
  success: boolean
  verifiedTransaction: PaymentTransaction
}> {
  try {
    await mockConfirmPayment(transaction.orderId, crypto.randomUUID())
    const updated: PaymentTransaction = {
      ...transaction,
      state: "SUCCESS",
      completedAt: new Date().toISOString(),
    }
    saveActiveTransaction(updated)
    return { success: true, verifiedTransaction: updated }
  } catch {
    const updated: PaymentTransaction = {
      ...transaction,
      state: "FAILED",
      errorMessage: PAYMENT_COPY.paymentFailedDescription,
    }
    saveActiveTransaction(updated)
    return { success: false, verifiedTransaction: updated }
  }
}

/**
 * Submits an order with CASH_PENDING status
 */
export async function submitCashPaymentOrder(
  order: OrderDraft,
  idempotencyKey: string
): Promise<SubmittedOrder> {
  const result = await submitGuestOrder({
    paymentMethod: "CASH",
    idempotencyKey,
    expectedTotalPaise: Math.round(order.pricing.total * 100),
  })
  if (result.priceChanged || !result.order) {
    throw new Error(PAYMENT_COPY.priceChangedDescription)
  }

  const submitted: SubmittedOrder = {
    orderId: result.order.id,
    shop: order.shop,
    totalAmount: result.quote.totalPaise / 100,
    currency: result.quote.currency,
    totalDocuments: order.documents.length,
    totalCopies: order.pricing.totalCopies,
    documents: order.documents,
    pricingItems: order.pricing.items,
    paymentMethod: "CASH",
    paymentState: "CASH_PENDING",
    status: "PLACED",
    submittedAt: new Date().toISOString(),
    idempotencyKey,
  }

  saveSubmittedOrder(submitted)
  clearActiveTransaction()
  return submitted
}

export async function submitOnlinePaidOrder(
  order: OrderDraft,
  transaction: PaymentTransaction
): Promise<SubmittedOrder> {
  const submitted: SubmittedOrder = {
    orderId: transaction.orderId,
    shop: order.shop,
    totalAmount: transaction.amount,
    currency: transaction.currency,
    totalDocuments: order.documents.length,
    totalCopies: order.pricing.totalCopies,
    documents: order.documents,
    pricingItems: order.pricing.items,
    paymentMethod: "ONLINE",
    paymentState: "SUCCESS",
    status: "PLACED",
    submittedAt: new Date().toISOString(),
    idempotencyKey: transaction.idempotencyKey,
  }

  saveSubmittedOrder(submitted)
  clearActiveTransaction()
  return submitted
}

/**
 * Persists active payment transaction to sessionStorage
 */
export function saveActiveTransaction(tx: PaymentTransaction): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      PAYMENT_STORAGE_KEYS.ACTIVE_TRANSACTION,
      JSON.stringify(tx)
    )
  } catch (e) {
    console.warn("Failed to persist transaction:", e)
  }
}

/**
 * Loads active payment transaction from sessionStorage
 */
export function getActiveTransaction(): PaymentTransaction | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(
      PAYMENT_STORAGE_KEYS.ACTIVE_TRANSACTION
    )
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Clears active payment transaction from sessionStorage
 */
export function clearActiveTransaction(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(PAYMENT_STORAGE_KEYS.ACTIVE_TRANSACTION)
  } catch (e) {
    console.warn("Failed to clear transaction:", e)
  }
}

/**
 * Persists the final submitted order to sessionStorage for Screen 05
 */
export function saveSubmittedOrder(order: SubmittedOrder): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      PAYMENT_STORAGE_KEYS.SUBMITTED_ORDER,
      JSON.stringify(order)
    )
  } catch (e) {
    console.warn("Failed to save submitted order:", e)
  }
}

/**
 * Loads the submitted order from sessionStorage for Screen 05
 */
export function getSubmittedOrder(): SubmittedOrder | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(
      PAYMENT_STORAGE_KEYS.SUBMITTED_ORDER
    )
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
