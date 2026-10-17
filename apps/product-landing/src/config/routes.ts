/** Section anchors and internal routes (PRD 3.1). Section IDs are stable; links are built from them. */
export const sectionIds = {
  hero: "hero",
  journey: "journey",
  customers: "customers",
  problem: "problem",
  shops: "shops",
  printers: "printers",
  money: "money",
  plans: "plans",
  trust: "trust",
  start: "start",
  faq: "faq",
  contact: "contact",
  main: "main",
} as const

export type SectionId = (typeof sectionIds)[keyof typeof sectionIds]

export const faqTabIds = {
  shops: "faq-shops",
  customers: "faq-customers",
} as const

export const anchor = (id: SectionId): `/#${SectionId}` => `/#${id}`

export const routes = {
  home: "/",
  privacy: "/privacy",
  terms: "/terms",
  api: {
    requestCall: "/api/request-call",
  },
} as const
