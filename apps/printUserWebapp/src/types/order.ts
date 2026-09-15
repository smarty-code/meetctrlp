import { ConfigurableDocument, ShopContext } from "./upload"

export interface OrderPricingItem {
  documentId: string
  documentName: string
  effectivePageCount: number
  copies: number
  colorMode: "bw" | "color"
  paperSize: string
  ratePerPage: number
  totalAmount: number
}

export interface FeeItem {
  id: string
  label: string
  amount: number
}

export interface TaxItem {
  id: string
  label: string
  amount: number
}

export interface DiscountItem {
  id: string
  label: string
  amount: number
}

export interface OrderPricingBreakdown {
  currency: string
  items: OrderPricingItem[]
  printCharges: number
  fees: FeeItem[]
  taxes: TaxItem[]
  discounts: DiscountItem[]
  total: number
  totalSelectedPages: number
  totalCopies: number
}

export interface OrderDraftMetadata {
  createdAt: string
  updatedAt: string
  guestSessionId: string
  idempotencyKey: string
  isPriceAuthoritative: boolean
}

export interface OrderDraft {
  orderId: string
  shop: ShopContext
  documents: ConfigurableDocument[]
  pricing: OrderPricingBreakdown
  metadata: OrderDraftMetadata
}

export interface OrderValidationResult {
  isValid: boolean
  errors: string[]
  invalidDocumentId?: string
}
