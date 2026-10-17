import type {
  GatedText,
  Headline,
  LabelledLine,
  SectionIntro,
} from "@/types/content"

/** CTA labels (PRD 3.4) and the shared WhatsApp message (PRD 5.12). */
export const ctas = {
  whatsapp: "Talk to us on WhatsApp",
  whatsappShort: "Talk to us",
  requestCall: "Request a call",
  seeCustomers: "See how customers print",
  openApp: "Open the print app",
  seeHow: "See how it works",
  contact: "Contact us",
  talkToHuman: "Talk to a human",
  whatsappMessage:
    "Hi MeetCtrlP, I run a print shop and I'd like to know more about CtrlP.",
} as const

/** 5.1 Hero */
export const heroCopy = {
  bracket: "For print shops",
  headline: {
    lead: "Your print shop, run from",
    emphasis: "one screen.",
    breakBefore: true,
  },
  subhead:
    "Customers scan your QR, upload and pay. You accept and print. No WhatsApp files, no confusion.",
  microcopy: [
    { text: "We take 0% on every print job.", claim: "zeroCommission" },
    { text: "Works with your existing printers.", claim: "existingPrinters" },
  ],
} as const satisfies {
  headline: Headline
  microcopy: readonly GatedText[]
} & Record<string, unknown>

/** 5.3 For customers */
export const customersCopy = {
  eyebrow: "FOR CUSTOMERS",
  headline: { lead: "Print it. Pick it.", emphasis: "Done." },
  body: "Printing at a CtrlP shop is quick. Scan the QR on the counter, upload your files, see the price and pay. Then collect your prints when the shop says they're ready.",
  points: [
    { text: "No app or account to set up", claim: "noAccount" },
    { text: "Choose colour, copies and pages for each file" },
    { text: "See the price before you pay" },
    {
      text: "Pay with UPI or pay at the shop",
      claim: "upi",
      fallback: "Pay online or pay at the shop",
    },
  ],
  note: "Look for the CtrlP QR code at the counter of a participating print shop.",
  button: "Open the print app",
} as const satisfies SectionIntro & { points: readonly GatedText[] } & Record<
    string,
    unknown
  >

/** 5.4 The counter today */
export const problemCopy = {
  eyebrow: "THE COUNTER TODAY",
  headline: {
    lead: "Printing shouldn't take",
    emphasis: "this much chasing.",
    breakBefore: true,
  },
  lines: [
    "Files arrive on WhatsApp, in five different chats.",
    "“Kaunse pages? Kitni copy?” The same questions, again and again.",
    "Settings set by hand, one job at a time.",
    "Cash in the drawer and UPI screenshots to match up.",
  ],
  closing: {
    lead: "Your counter works. It just takes",
    emphasis: "too many steps.",
    breakBefore: true,
  },
  bubbles: [
    { text: "Bhaiya, ye print kar do", side: "customer" },
    { text: "Colour mein?", side: "shop" },
    { text: "Haan, 2 copy", side: "customer" },
    { text: "Kaunse pages?", side: "shop" },
    { text: "Sirf 1 se 5", side: "customer" },
  ],
  files: ["resume_final_v2.pdf", "marksheet (1).pdf"],
} as const satisfies SectionIntro & { closing: Headline } & Record<
    string,
    unknown
  >

/** 5.5 What you get as a shop (tiles live in tiles.ts) */
export const shopsCopy = {
  eyebrow: "FOR PRINT SHOPS",
  headline: {
    lead: "Everything your counter needs,",
    emphasis: "in one place.",
    breakBefore: true,
  },
  intro: "One desktop app for orders, printing and payments.",
} as const satisfies SectionIntro

/** 5.6 Printer setup */
export const printersCopy = {
  eyebrow: "PRINTER SETUP",
  headline: { lead: "Works with the printers you", emphasis: "already have." },
  headlineFallback: { lead: "Connects to your shop's", emphasis: "printers." },
  headlineClaim: "existingPrinters",
  intro:
    "A small CtrlP program runs on your shop computer and talks to your printers. Your printers don't need to be put on the internet.",
  nodes: [
    { label: "CtrlP", caption: "Orders and print jobs" },
    { label: "Your shop computer", caption: "CtrlP print agent" },
    { label: "Your printers", caption: "Colour, B&W, Xerox" },
  ],
  reassurance: [
    {
      text: "We help set up your printers and the shop QR.",
      claim: "setupSupport",
    },
    {
      text: "Tell CtrlP which printer does colour, which does black and white, and which sizes you offer.",
      claim: "printerRouting",
    },
    {
      text: "You see each printer's status: connected, printing, offline.",
      claim: "printerStatus",
    },
  ],
  note: "Supported printers are confirmed during setup.",
} as const satisfies {
  headline: Headline
  headlineFallback: Headline
  reassurance: readonly GatedText[]
} & Record<string, unknown>

/** 5.7 Money */
export const moneyCopy = {
  eyebrow: "PAYMENTS",
  stat: "0%",
  statCaption: "commission on every print job.",
  statClaim: "zeroCommission",
  headline: { lead: "The customer pays. You", emphasis: "keep it all." },
  body: "When a customer pays online, CtrlP confirms the payment before you print, then settles the full amount to you. When they choose pay at shop, you collect at the counter and mark it paid.",
  rows: [
    { label: "Online payment.", text: "Confirmed before you print." },
    {
      label: "Pay at shop.",
      text: "Clearly marked on the order so nothing gets missed.",
    },
  ],
  commissionRow: {
    label: "Your plan is the only cost.",
    text: "We don't take a cut of print payments.",
  },
  settlementLabel: "Settlement.",
  flow: ["Customer pays {amount}", "CtrlP confirms", "You receive {amount}"],
  flowLabel: "Example payment flow",
} as const satisfies SectionIntro & { rows: readonly LabelledLine[] } & Record<
    string,
    unknown
  >

/** 5.8 Plans (no prices; see pricing.server.ts for the flagged tiers) */
export const plansCopy = {
  eyebrow: "PLANS",
  headline: { lead: "Plans built around", emphasis: "your shop." },
  intro:
    "Every shop prints differently. Tell us about your counter and we'll suggest a plan that fits.",
  cardTitle: "Talk to us about your shop",
  cardText:
    "We'll ask a few simple questions about your shop size and printers, then recommend a plan.",
  includedTitle: "Included with every plan",
  included: [
    { text: "Your own shop QR code", claim: "includesQr" },
    { text: "The CtrlP desktop app", claim: "includesDesktopApp" },
    { text: "Printer connection support", claim: "setupSupport" },
    { text: "Order and payment tracking", claim: "includesTracking" },
    { text: "WhatsApp support", claim: "includesWhatsappSupport" },
  ],
  audienceTitle: "Who it's for",
  audiences: ["Small shops", "Busy print and Xerox shops", "High-volume shops"],
  microcopy: "No pressure. Just a conversation.",
  tiersTitle: "Plans",
  perDay: "{amount} per day",
  perMonth: "{amount} per month",
} as const satisfies SectionIntro & { included: readonly GatedText[] } & Record<
    string,
    unknown
  >

/** 5.9 Trust and privacy */
export const trustCopy = {
  eyebrow: "DESIGNED WITH CARE",
  headline: {
    lead: "Your customers' documents are",
    emphasis: "safe with us.",
    breakBefore: true,
  },
  promises: [
    { title: "Safety.", claim: "promiseDeleted" },
    { title: "Security.", claim: "promiseSealed" },
    { title: "No Peek Policy.", claim: "promiseNoPeek" },
  ],
  control: {
    label: "You stay in control.",
    text: "Every order is yours to review and accept. CtrlP helps with the repetitive steps; you decide what gets printed.",
  },
  access: {
    text: "Each shop sees only its own orders.",
    claim: "shopOnlyAccess",
  },
  privacyLink: "Read our Privacy Policy",
} as const satisfies SectionIntro & { access: GatedText } & Record<
    string,
    unknown
  >

/** 5.10 How to start */
export const startCopy = {
  eyebrow: "GET STARTED",
  headline: { lead: "Three steps to your first", emphasis: "order." },
  steps: [
    {
      title: "Talk to us",
      text: {
        text: "Message us on WhatsApp or ask for a call. Tell us about your shop and printers.",
      },
    },
    {
      title: "We set up your shop",
      text: {
        text: "Your shop profile, your prices, your QR code and your printer connection.",
        claim: "setupSupport",
        fallback: "Your shop profile, your prices and your QR code.",
      },
    },
    {
      title: "Start taking orders",
      text: {
        text: "Put your QR code on the counter. Customers scan, you accept and print.",
      },
    },
  ],
} as const satisfies SectionIntro & {
  steps: ReadonlyArray<{ title: string; text: GatedText }>
}

/** 5.12 Closing CTA */
export const contactCopy = {
  bracket: "Get in touch",
  headline: {
    lead: "Ready to take print orders the",
    emphasis: "easy way?",
    breakBefore: true,
  },
  body: "Message us and we'll help you get your shop set up. No pressure, just a conversation.",
  customerLead:
    "Just here to print? Scan the QR code at your print shop's counter, or",
  customerLink: "open the print app",
} as const satisfies { headline: Headline } & Record<string, unknown>
