import { routes } from "@/config/routes"
import { ownerInputs } from "@/content/ownerInputs"
import type { ClaimKey } from "@/content/claims"
import type { Headline } from "@/types/content"

export type FaqTabKey = "shops" | "customers"

/**
 * One FAQ entry. `answer: null` means the owner has not supplied it yet (a placeholder),
 * and `claim` gates the whole item; either way the item is not rendered.
 */
export type FaqItem = {
  readonly question: string
  readonly answer: string | null
  readonly claim?: ClaimKey
  readonly link?: { readonly label: string; readonly href: string }
}

export type FaqTab = {
  readonly key: FaqTabKey
  readonly label: string
  readonly items: readonly FaqItem[]
}

/** A tab with fewer than this many renderable questions is hidden (PRD 5.11). */
export const minFaqItemsPerTab = 3

export const faqCopy = {
  eyebrow: "FAQ",
  headline: { lead: "Common", emphasis: "questions." } satisfies Headline,
  tabsLabel: "Questions for",
  stillTitle: "Still have questions?",
} as const

export const faqTabs = [
  {
    key: "shops",
    label: "Print shops",
    items: [
      {
        question: "How does printing from CtrlP work on my computer?",
        answer:
          "A small CtrlP program runs on your shop computer and sends accepted jobs to your printers. You don't need to download each file.",
        claim: "autoPrint",
      },
      {
        question: "Which printers work with CtrlP?",
        answer:
          "We confirm supported printers during setup. Tell us which printers you use and we'll check them with you.",
      },
      {
        question: "Do I need new hardware?",
        answer: "You use your own shop computer and printers.",
        claim: "existingPrinters",
      },
      {
        question: "How do I get paid?",
        answer:
          "Online payments are confirmed before you print, then settled to you in full. For pay at shop, you collect at the counter and mark the order paid.",
      },
      {
        question: "Do you take a commission?",
        answer: "No. We take 0% on print jobs. Your plan is the only cost.",
        claim: "zeroCommission",
      },
      {
        question: "What does CtrlP cost?",
        answer:
          "Plans are built around your shop. Talk to us and we'll recommend the right one.",
      },
      {
        question: "What if a print fails?",
        answer:
          "You'll see the failure in your print queue and can retry or send the job to another printer.",
        claim: "retry",
      },
      {
        question: "Can my staff log in separately?",
        answer: "Not yet. Right now each shop uses one login.",
        claim: "singleLogin",
      },
      {
        question: "How are my customers' documents handled?",
        answer:
          "Documents are deleted once printed, and our staff do not look at them.",
        link: { label: "See our Privacy Policy.", href: routes.privacy },
      },
      { question: "How long does setup take?", answer: ownerInputs.setupTime },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    items: [
      {
        question: "How do I start printing?",
        answer:
          "Scan the CtrlP QR code at the shop counter. It opens that shop so you can upload your documents.",
      },
      {
        question: "What document formats can I print?",
        answer: "PDF, JPG, PNG, DOC/DOCX and PPT/PPTX.",
        claim: "fileFormats",
      },
      {
        question: "What printing options can I choose from?",
        answer:
          "Colour or black and white, number of copies, paper size and which pages to print, for each document.",
        claim: "printOptions",
      },
      {
        question: "How do I upload my documents?",
        answer:
          "After scanning the QR, choose your files from your phone or computer. You can add more than one.",
      },
      {
        question: "Are my documents handled securely?",
        answer:
          "Documents are deleted once printed, and our staff will not look at them.",
      },
      {
        question: "What is the maximum number of files I can upload?",
        answer: ownerInputs.maxFiles,
      },
      {
        question: "I have an issue with my order. What now?",
        answer: ownerInputs.orderIssue,
      },
      {
        question: "How long will my order take?",
        answer: ownerInputs.orderTime,
      },
    ],
  },
] as const satisfies readonly FaqTab[]
