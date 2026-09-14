import { ShopContext } from "../types/upload"
import { OrderDraft } from "../types/order"
import {
  PaymentMethodItem,
  PaymentTransaction,
  SubmittedOrder,
} from "../types/payment"
import {
  PAYMENT_COPY,
  PAYMENT_STORAGE_KEYS,
  PAYMENT_TIMINGS,
} from "./payment-constants"
import { calculateOrderPricing } from "./order-repository"

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
      enabled: true,
      badgeText: PAYMENT_COPY.onlineMethodBadge,
    },
    {
      id: "CASH",
      title: PAYMENT_COPY.cashMethodTitle,
      description: PAYMENT_COPY.cashMethodDescription,
      iconName: "cash",
      enabled: shop.status === "OPEN" || shop.status === "BUSY",
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
}> {
  // Authoritative server-side price check simulation
  await new Promise((resolve) =>
    setTimeout(resolve, PAYMENT_TIMINGS.PRICE_CHECK_MS)
  )

  const freshPricing = calculateOrderPricing(order.documents, order.shop)
  if (freshPricing.total !== order.pricing.total) {
    return {
      transaction: {
        transactionId: `TXN-ERR-${Date.now().toString(36).toUpperCase()}`,
        orderId: order.orderId,
        amount: freshPricing.total,
        currency: freshPricing.currency,
        method: "ONLINE",
        state: "FAILED",
        initiatedAt: new Date().toISOString(),
        idempotencyKey,
        errorMessage: PAYMENT_COPY.priceChangedDescription,
      },
      priceChanged: true,
      authoritativeTotal: freshPricing.total,
    }
  }

  // Simulate payment gateway checkout session creation
  await new Promise((resolve) => setTimeout(resolve, PAYMENT_TIMINGS.INITIATE_MS))

  const transaction: PaymentTransaction = {
    transactionId: `TXN-${Date.now().toString(36).toUpperCase()}`,
    orderId: order.orderId,
    amount: freshPricing.total,
    currency: freshPricing.currency,
    method: "ONLINE",
    state: "VERIFICATION_PENDING",
    initiatedAt: new Date().toISOString(),
    providerReference: `PROV-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    idempotencyKey,
  }

  saveActiveTransaction(transaction)

  return {
    transaction,
    priceChanged: false,
    authoritativeTotal: freshPricing.total,
  }
}

/**
 * Server-side payment verification simulation
 */
export async function verifyPaymentTransaction(
  transaction: PaymentTransaction
): Promise<{
  success: boolean
  verifiedTransaction: PaymentTransaction
}> {
  // Simulated gateway verification roundtrip
  await new Promise((resolve) => setTimeout(resolve, PAYMENT_TIMINGS.VERIFY_MS))

  const updated: PaymentTransaction = {
    ...transaction,
    state: "SUCCESS",
    completedAt: new Date().toISOString(),
  }

  saveActiveTransaction(updated)

  return {
    success: true,
    verifiedTransaction: updated,
  }
}

/**
 * Submits an order with CASH_PENDING status
 */
export async function submitCashPaymentOrder(
  order: OrderDraft,
  idempotencyKey: string
): Promise<SubmittedOrder> {
  // Brief backend registration simulation
  await new Promise((resolve) => setTimeout(resolve, PAYMENT_TIMINGS.INITIATE_MS))

  const submitted: SubmittedOrder = {
    orderId: order.orderId,
    shop: order.shop,
    totalAmount: order.pricing.total,
    currency: order.pricing.currency,
    totalDocuments: order.documents.length,
    totalCopies: order.pricing.totalCopies,
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

/**
 * Submits an order following successful online payment verification
 */
export async function submitOnlinePaidOrder(
  order: OrderDraft,
  transaction: PaymentTransaction
): Promise<SubmittedOrder> {
  const submitted: SubmittedOrder = {
    orderId: order.orderId,
    shop: order.shop,
    totalAmount: transaction.amount,
    currency: transaction.currency,
    totalDocuments: order.documents.length,
    totalCopies: order.pricing.totalCopies,
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
