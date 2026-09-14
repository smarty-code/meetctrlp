import { ShopContext } from "./upload"

export type PaymentMethodId = "ONLINE" | "CASH"

export type PaymentState =
  | "NOT_STARTED"
  | "METHOD_SELECTED"
  | "INITIATING"
  | "PENDING"
  | "VERIFICATION_PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "CASH_PENDING"

export interface PaymentMethodItem {
  id: PaymentMethodId
  title: string
  description: string
  iconName: "upi" | "cash" | "card"
  enabled: boolean
  disabledReason?: string
  supportingText?: string
  badgeText?: string
}

export interface PaymentTransaction {
  transactionId: string
  orderId: string
  amount: number
  currency: string
  method: PaymentMethodId
  state: PaymentState
  initiatedAt: string
  completedAt?: string
  providerReference?: string
  idempotencyKey: string
  errorMessage?: string
}

export type OrderPlacementStatus =
  | "PLACED"
  | "SHOP_ACCEPTED"
  | "PRINTING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "FAILED"

export interface SubmittedOrder {
  orderId: string
  shop: ShopContext
  totalAmount: number
  currency: string
  totalDocuments: number
  totalCopies: number
  paymentMethod: PaymentMethodId
  paymentState: PaymentState
  status: OrderPlacementStatus
  submittedAt: string
  idempotencyKey: string
}
