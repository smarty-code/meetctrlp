export const PAYMENT_ROUTES = {
  HOME: "/",
  CUSTOMIZE: "/customize",
  REVIEW: "/review",
  PAYMENT: "/payment",
  ORDER_STATUS: "/order-status",
} as const

export const PAYMENT_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  METHOD_SELECTED: "METHOD_SELECTED",
  INITIATING: "INITIATING",
  PENDING: "PENDING",
  VERIFICATION_PENDING: "VERIFICATION_PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  CASH_PENDING: "CASH_PENDING",
} as const

export const PAYMENT_STORAGE_KEYS = {
  ACTIVE_TRANSACTION: "ctrlp-active-payment-transaction",
  SUBMITTED_ORDER: "ctrlp-submitted-order",
} as const

export const PAYMENT_TIMINGS = {
  PRICE_CHECK_MS: 300,
  INITIATE_MS: 500,
  VERIFY_MS: 900,
  SUCCESS_TRANSITION_MS: 400,
} as const

export const PAYMENT_COPY = {
  headerTitle: "Payment",
  backButtonAria: "Back to review order",
  orderSummaryTitle: "Your Order",
  orderRefPrefix: "Order Reference",
  amountToPayLabel: "Amount to pay",
  choosePaymentTitle: "Choose payment method",
  onlineMethodTitle: "UPI / Online Payment",
  onlineMethodDescription: "Pay securely online via UPI, Cards, or Net Banking",
  onlineMethodBadge: "Instant Confirmation",
  cashMethodTitle: "Cash at Shop",
  cashMethodDescription: "Pay when you collect your printed documents at the counter",
  cashMethodBadge: "Pay on Pickup",
  amountDueAtShop: (amount: string) => `Amount due at shop: ${amount}`,
  onlineCTAPrefix: "Pay",
  cashCTA: "Continue with Cash",
  startingPaymentCTA: "Starting secure payment...",
  verifyingPaymentCTA: "Checking payment status...",
  confirmingOrderCTA: "Confirming your order...",
  paymentSuccessNotice: "Payment successful! Finalizing your order...",
  paymentFailedTitle: "Payment couldn't be completed",
  paymentFailedDescription:
    "The payment could not be processed. Don't worry, your money was not deducted. You can try again or choose to pay cash at the shop.",
  retryCTA: "Try Again",
  switchMethodCTA: "Choose Another Method",
  paymentPendingTitle: "Payment is being confirmed",
  paymentPendingDescription:
    "We are confirming your payment status with the provider. Please do not close this window.",
  priceChangedTitle: "Price Updated",
  priceChangedDescription:
    "The total price was recalculated by the system. Please review the updated amount before continuing.",
  reviewPriceCTA: "Back to Review",
  loadingDetails: "Loading payment details...",
  errorLoadingOrder: "We couldn't load your order for payment.",
  errorEmptyOrder: "No active order found to pay for.",
  returnToUploadCTA: "Start New Order",
  backConfirmInFlight:
    "A payment transaction is currently processing. Going back may disrupt confirmation. Are you sure you want to go back?",
} as const
