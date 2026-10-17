/**
 * Claims Registry for MeetCtrlP
 * Governed by PRD Section 6.2.
 * Claims are factual statements about product features.
 * A claim only renders when `verified: true`.
 * The owner flips each flag after confirming that the shipped product does what the sentence says.
 */

export interface ClaimItem {
  readonly text: string
  readonly verified: boolean
}

export const claims = {
  fileFormats: {
    text: "Upload PDF, DOCX, PPTX, JPG or PNG",
    verified: false,
  },
  noAccount: {
    text: "No account needed",
    verified: false,
  },
  colourOrBw: {
    text: "Colour or black & white",
    verified: false,
  },
  copiesAndPages: {
    text: "Choose copies and pages",
    verified: false,
  },
  priceBeforePay: {
    text: "See the price before you pay",
    verified: false,
  },
  payOnlineOrShop: {
    text: "Pay online or at the shop",
    verified: false,
  },
  trackOrder: {
    text: "Track your order",
    verified: false,
  },
  autoPrint: {
    text: "...sends the job to a connected printer.",
    verified: false,
  },
  controlledAccess: {
    text: "Access to documents is limited to the people and systems needed to fulfil the order.",
    verified: false,
  },
  secureHandling: {
    text: "Files are protected in transit and at rest, with access governed by permissions.",
    verified: false,
  },
  retention: {
    text: "Documents are deleted according to our published retention policy.",
    verified: false,
  },
} as const

export type ClaimKey = keyof typeof claims

/**
 * Check if a claim is verified dynamically
 */
export function isClaimVerified(key: ClaimKey): boolean {
  return claims[key]?.verified ?? false
}

/**
 * Return all verified claims for the FactStrip marquee
 */
export function getVerifiedFactClaims(): string[] {
  const factKeys: ClaimKey[] = [
    "fileFormats",
    "noAccount",
    "colourOrBw",
    "copiesAndPages",
    "priceBeforePay",
    "payOnlineOrShop",
    "trackOrder",
  ]
  return factKeys
    .filter((key) => isClaimVerified(key))
    .map((key) => claims[key].text)
}

/**
 * Return verified trust rows.
 * Section 5.6 rule: If fewer than two rows are verified, hide the entire section.
 */
export interface TrustRow {
  number: string
  title: string
  text: string
  verified: boolean
}

export function getVerifiedTrustRows(): TrustRow[] {
  const rows: TrustRow[] = [
    {
      number: "01",
      title: "The shop reviews every order.",
      text: "Automation handles repetitive steps. Shops accept each order and stay in charge of fulfilment.",
      verified: true, // Base structural statement
    },
    {
      number: "02",
      title: "Controlled access.",
      text: claims.controlledAccess.text,
      verified: claims.controlledAccess.verified,
    },
    {
      number: "03",
      title: "Secure handling.",
      text: claims.secureHandling.text,
      verified: claims.secureHandling.verified,
    },
  ]

  // Retention row: only rendered if retention claim is verified
  if (claims.retention.verified) {
    rows.push({
      number: `0${rows.length + 1}`,
      title: "Retention policy.",
      text: claims.retention.text,
      verified: true,
    })
  }

  return rows.filter((r) => r.verified)
}
