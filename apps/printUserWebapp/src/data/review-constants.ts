export const REVIEW_ROUTES = {
  HOME: "/",
  CUSTOMIZE: "/customize",
  REVIEW: "/review",
  PAYMENT: "/payment",
  ORDER_STATUS: "/order-status",
} as const

export const STORAGE_KEYS = {
  UPLOADED_FILES: "ctrlp-uploaded-files",
  CONFIGURED_DOCUMENTS: "ctrlp-configured-documents",
  ORDER_DRAFT: "ctrlp-order-draft",
  GUEST_SESSION: "ctrlp-guest-session-id",
} as const

export const REVIEW_COPY = {
  headerTitle: "Review Order",
  backButtonAria: "Back to document configuration",
  shopSectionLabel: "Printing At",
  documentsSectionTitle: "Your Documents",
  priceSummaryTitle: "Price Summary",
  printChargesLabel: "Print charges",
  totalPayableLabel: "Total Payable",
  continueCTA: "Continue to Payment",
  checkingPriceCTA: "Checking final price...",
  editDocumentAria: (docName: string) => `Edit print settings for ${docName}`,
  allPages: "All pages",
  pagesPrefix: "Pages",
  copiesSingular: "1 copy",
  copiesPlural: (count: number) => `${count} copies`,
  pagesSingular: "1 page",
  pagesPlural: (count: number) => `${count} pages`,
  bwLabel: "B&W",
  colorLabel: "Color",
  defaultPaperSize: "A4",
  loadingOrder: "Loading your order...",
  validatingPrice: "Checking final price...",
  priceChangedTitle: "Price Updated",
  priceChangedMessage:
    "The shop's pricing or calculation has updated. Please review the updated total before proceeding.",
  emptyTitle: "No documents to review",
  emptyDescription: "Please add and configure at least one document before reviewing your order.",
  addDocumentsCTA: "Upload Documents",
  errorTitle: "Couldn't load your order",
  errorDescription: "We ran into an issue retrieving your order details. Your documents are safe.",
  retryCTA: "Try Again",
  sessionExpired: "Your guest order session has expired. Please start fresh from the shop screen.",
} as const
