import {
  OrderLifecycleStatus,
  StatusPresentationConfig,
} from "../types/tracking";

export const TRACKING_ROUTES = {
  HOME: "/",
  CUSTOMIZE: "/customize",
  REVIEW: "/review",
  PAYMENT: "/payment",
  ORDER_STATUS: "/order-status",
} as const;

export const ORDER_LIFECYCLE_ORDER: OrderLifecycleStatus[] = [
  "SUBMITTED",
  "ACCEPTED",
  "PRINTING",
  "READY",
  "COMPLETED",
];

export const ORDER_STATUS_PRESENTATION: Record<
  OrderLifecycleStatus,
  StatusPresentationConfig
> = {
  SUBMITTED: {
    label: "Order received",
    headline: "Your order is confirmed",
    customerDescription:
      "Your print order has been sent to the shop and is awaiting acceptance.",
    badgeVariant: "neutral",
    iconName: "check-circle",
    stepIndex: 0,
    isTerminal: false,
  },
  ACCEPTED: {
    label: "Shop accepted",
    headline: "Shop accepted your order",
    customerDescription:
      "Your documents are queued up in the shop's print line.",
    badgeVariant: "default",
    iconName: "clock",
    stepIndex: 1,
    isTerminal: false,
  },
  PRINTING: {
    label: "Printing",
    headline: "Printing your documents",
    customerDescription:
      "The shop printer is currently preparing your documents.",
    badgeVariant: "default",
    iconName: "printer",
    stepIndex: 2,
    isTerminal: false,
  },
  READY: {
    label: "Ready for collection",
    headline: "Your prints are ready!",
    customerDescription:
      "Collect your printed documents from the shop counter.",
    badgeVariant: "success",
    iconName: "package-check",
    stepIndex: 3,
    isTerminal: false,
  },
  COMPLETED: {
    label: "Order completed",
    headline: "Order collected",
    customerDescription:
      "Thank you for using CtrlP. Your order has been completed.",
    badgeVariant: "success",
    iconName: "package-check",
    stepIndex: 4,
    isTerminal: true,
  },
  REJECTED: {
    label: "Order couldn't be accepted",
    headline: "Shop unable to accept order",
    customerDescription:
      "The shop is temporarily unable to fulfill this order. Any online payment will be refunded.",
    badgeVariant: "destructive",
    iconName: "alert-circle",
    stepIndex: 1,
    isTerminal: true,
  },
  CANCELLED: {
    label: "Order cancelled",
    headline: "This order was cancelled",
    customerDescription: "This order has been cancelled.",
    badgeVariant: "destructive",
    iconName: "x-circle",
    stepIndex: 1,
    isTerminal: true,
  },
  FAILED: {
    label: "Printing failed",
    headline: "Printing could not be completed",
    customerDescription:
      "There was a problem while printing your order. The shop counter staff will assist you.",
    badgeVariant: "destructive",
    iconName: "alert-circle",
    stepIndex: 2,
    isTerminal: true,
  },
};

export const TRACKING_TIMINGS = {
  POLLING_INTERVAL_MS: 6000,
  SIMULATION_STEP_MS: 4000,
  COPY_FEEDBACK_DURATION_MS: 2000,
  REFRESH_DEBOUNCE_MS: 1000,
} as const;

export const TRACKING_STORAGE_KEYS = {
  ORDER_TRACKING_CACHE: "ctrlp-active-order-tracking",
} as const;

export const TRACKING_COPY = {
  headerTitle: "Order Status",
  screenTag: "Screen 05",
  newOrderCTA: "New Order",
  refreshAria: "Refresh order status",
  refreshingText: "Checking for updates...",
  copyOrderNumber: "Copy order number",
  copiedFeedback: "Copied!",
  orderTimelineTitle: "Order Progress",
  estimatedTimeTitle: "Estimated Ready Time",
  noEstimateAvailable: "The shop hasn't provided an estimated ready time yet.",
  shopCardTitle: "Printing At",
  pickupInstructionsTitle: "Pickup Instructions",
  defaultPickupInstructions:
    "Show your order reference number at the counter when you arrive.",
  callShopCTA: "Call Shop",
  directionsCTA: "Get Directions",
  paymentCardTitle: "Payment Details",
  paidOnlineBadge: "Paid Online",
  payAtShopBadge: "Pay at Shop Counter",
  amountPaidLabel: "Amount paid:",
  amountDueLabel: "Amount due at pickup:",
  documentSummaryTitle: "Documents Summary",
  showDetails: "View document details",
  hideDetails: "Hide details",
  documentsCountLabel: (docs: number, pages: number) =>
    `${docs} document${docs === 1 ? "" : "s"} (${pages} page${pages === 1 ? "" : "s"})`,
  orderNotFoundTitle: "Order Not Found",
  orderNotFoundDescription:
    "We couldn't find active order details for this session. You can start a new print order.",
  fetchFailedTitle: "Unable to load order",
  fetchFailedDescription:
    "We could not reach the server to fetch your order status. Please check your connection and try again.",
  retryCTA: "Try Again",
  contactShopSupportCTA: "Contact Shop Support",
} as const;
