/**
 * Claims registry (PRD 6.2). Components never render a claim directly;
 * they go through `resolveClaim` so an unverified claim shows its fallback or nothing.
 *
 * The four owner-confirmed entries are true by owner instruction. They are absolute
 * statements: the owner must confirm before launch that the product behaves exactly so (PRD 10.3).
 * Flip each capability to `true` only after the shipped product does exactly what it says.
 */
export type Claim = {
  readonly text: string
  readonly verified: boolean
  readonly fallback: string | null
}

export const claims = {
  // Owner-confirmed promises
  promiseDeleted: {
    text: "Documents are deleted once printed.",
    verified: true,
    fallback: null,
  },
  promiseSealed: {
    text: "Prints are sealed before delivery.",
    verified: true,
    fallback: null,
  },
  promiseNoPeek: {
    text: "Our staff will not look at your documents.",
    verified: true,
    fallback: null,
  },
  zeroCommission: {
    text: "We take 0% on every print job.",
    verified: true,
    fallback: null,
  },

  // Product capabilities
  noAccount: { text: "No account needed", verified: false, fallback: null },
  upi: {
    text: "Pay with UPI or pay at the shop",
    verified: false,
    fallback: "Pay online or pay at the shop",
  },
  fileFormats: {
    text: "PDF, JPG, PNG, DOC/DOCX and PPT/PPTX",
    verified: false,
    fallback: null,
  },
  printOptions: {
    text: "Colour or B&W, copies, paper size and pages",
    verified: false,
    fallback: null,
  },
  autoPrint: {
    text: "Accepted orders go straight to your printer",
    verified: false,
    fallback:
      "The job is prepared for your printer and tracked in your print queue.",
  },
  printerRouting: {
    text: "Colour jobs to the colour printer, B&W to the other",
    verified: false,
    fallback: null,
  },
  retry: {
    text: "Retry a failed print or change printer",
    verified: false,
    fallback: null,
  },
  printerStatus: {
    text: "See each printer's status",
    verified: false,
    fallback: null,
  },
  existingPrinters: {
    text: "Works with the printers you already have",
    verified: false,
    fallback: "Connects to your shop's printers.",
  },
  setupSupport: {
    text: "We help set up your printers and shop QR",
    verified: false,
    fallback: "Your shop profile, your prices and your QR code.",
  },
  shopOnlyAccess: {
    text: "Each shop sees only its own orders",
    verified: false,
    fallback: null,
  },
  singleLogin: {
    text: "Each shop uses one login for now",
    verified: false,
    fallback: null,
  },

  // "Included with every plan" (PRD 5.8 marks each item [VERIFY] without naming a key).
  // TODO(owner): confirm each inclusion and flip it to true.
  includesQr: {
    text: "Your own shop QR code",
    verified: false,
    fallback: null,
  },
  includesDesktopApp: {
    text: "The CtrlP desktop app",
    verified: false,
    fallback: null,
  },
  includesTracking: {
    text: "Order and payment tracking",
    verified: false,
    fallback: null,
  },
  includesWhatsappSupport: {
    text: "WhatsApp support",
    verified: false,
    fallback: null,
  },
} as const satisfies Record<string, Claim>

export type ClaimKey = keyof typeof claims
