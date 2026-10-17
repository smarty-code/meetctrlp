/** Analytics event names and allowed properties (PRD 8). Never put personal data in properties. */
export const events = {
  navClick: "nav_click",
  whatsappClick: "whatsapp_click",
  requestCallOpen: "request_call_open",
  requestCallSubmit: "request_call_submit",
  customerAppClick: "customer_app_click",
  journeyStepView: "journey_step_view",
  bentoView: "bento_view",
  plansView: "plans_view",
  faqTab: "faq_tab",
  faqOpen: "faq_open",
  sectionView: "section_view",
} as const

export type EventName = (typeof events)[keyof typeof events]

export type CtaLocation =
  | "header"
  | "hero"
  | "customers"
  | "plans"
  | "start"
  | "faq"
  | "contact"
  | "footer"
  | "menu"

export type EventProps = {
  nav_click: { label: string }
  whatsapp_click: { location: CtaLocation }
  request_call_open: { location: CtaLocation }
  request_call_submit: undefined
  customer_app_click: { location: CtaLocation }
  journey_step_view: { step: number }
  bento_view: undefined
  plans_view: undefined
  faq_tab: { tab: string }
  faq_open: { tab: string; index: number }
  section_view: { id: string }
}

/** Share of a section that must be visible before it counts as viewed. */
export const viewThreshold = 0.5
