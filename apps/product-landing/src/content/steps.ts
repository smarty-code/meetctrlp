import type { GatedText, SectionIntro } from "@/types/content"

export type Lane = "customer" | "shop" | "both"

/** Which concept a journey step shows (PRD 5.2 "Concepts per step"). */
export type JourneyScene = "upload" | "configure" | "accept" | "print" | "ready"

export type JourneyStep = {
  readonly lane: Lane
  readonly title: string
  readonly line: string
  readonly detail: GatedText
  readonly scene: JourneyScene
}

export const journeyCopy = {
  eyebrow: "HOW IT WORKS",
  headline: { lead: "One order, from QR to", emphasis: "counter." },
  intro:
    "Here is what happens when someone prints at a CtrlP shop. Customers do the first part. You take it from there.",
  lanes: { customer: "Customer", shop: "Shop", both: "Both" },
  laneIndicatorLabel: "Who acts at this step",
  stepsLabel: "Five steps of a CtrlP order",
} as const satisfies SectionIntro & Record<string, unknown>

/** 5.2 Journey: exactly five steps. */
export const journeySteps = [
  {
    lane: "customer",
    title: "Scan and upload",
    line: "Scan the QR on your counter.",
    detail: {
      text: "The customer opens your shop, uploads their documents and adds as many files as they need. No account.",
      claim: "noAccount",
      fallback:
        "The customer opens your shop, uploads their documents and adds as many files as they need.",
    },
    scene: "upload",
  },
  {
    lane: "customer",
    title: "Choose and pay",
    line: "Settings and price, clear before paying.",
    detail: {
      text: "For each document they pick colour or black and white, copies, A4 and pages. They see the price, then pay online or choose to pay at your shop.",
    },
    scene: "configure",
  },
  {
    lane: "shop",
    title: "You accept",
    line: "The order arrives ready to review.",
    detail: {
      text: "It shows up in your desktop app with every setting and the payment status. You check it and tap Accept.",
    },
    scene: "accept",
  },
  {
    lane: "shop",
    title: "It prints",
    line: "Accepted orders go straight to your printer.",
    detail: {
      text: "The job goes to the right printer through the CtrlP print agent on your shop computer. You watch it in the print queue.",
      claim: "autoPrint",
      fallback:
        "The job is prepared for your printer and tracked in your print queue.",
    },
    scene: "print",
  },
  {
    lane: "both",
    title: "Ready, collect, done",
    line: "Mark ready. Hand over. Complete.",
    detail: {
      text: "The customer sees “Ready for pickup”. You collect cash if it was pay-at-shop and mark the order complete.",
    },
    scene: "ready",
  },
] as const satisfies readonly JourneyStep[]
