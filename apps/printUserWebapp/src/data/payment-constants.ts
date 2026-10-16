export const PAYMENT_STORAGE_KEYS = {
  ACTIVE_TRANSACTION: "ctrlp-active-payment-transaction",
  /** The idempotency key of the checkout in progress, so a retried submit replays it. */
  CHECKOUT_KEY: "ctrlp-checkout-key",
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
    "The payment could not be processed. Don't worry, your money was not deducted. Your order is saved: try the payment again, or cancel the order from its tracking page.",
  /** Why cash is off once an online order has been placed and is waiting for its payment. */
  onlineOrderPendingReason: "This order was placed for online payment",
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
