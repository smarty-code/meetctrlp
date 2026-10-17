import type { GatedText } from "@/types/content"

/** Desktop concept screens a bento tile can show (PRD 4.10). */
export type TileVisual =
  "queue" | "job" | "payment" | "routing" | "failure" | "pricing"

/** Grid footprint on the 6-column desktop bento (PRD 5.5). */
export type TileSize = "large" | "wide" | "small" | "strip"

export type BentoTile = {
  readonly id: string
  readonly size: TileSize
  readonly title: string
  readonly line: GatedText
  readonly visual: TileVisual
}

const neutralFallback = "Part of the CtrlP shop software."

/** Minimum tiles before the bento falls back to a numbered list (PRD 5.5). */
export const minBentoTiles = 4

export const bentoTiles = [
  {
    id: "A",
    size: "large",
    title: "Orders arrive ready to print",
    line: {
      text: "Every file, setting and price in one order. No downloading, no asking again.",
    },
    visual: "queue",
  },
  {
    id: "B",
    size: "wide",
    title: "Accept, and it prints",
    line: {
      text: "Tap Accept and the job goes to your printer.",
      claim: "autoPrint",
      fallback: neutralFallback,
    },
    visual: "job",
  },
  {
    id: "C",
    size: "small",
    title: "Know who has paid",
    line: { text: "Paid online or pay at shop, clear on every order." },
    visual: "payment",
  },
  {
    id: "D",
    size: "small",
    title: "The right printer, every time",
    line: {
      text: "Colour jobs to your colour printer, B&W to the other.",
      claim: "printerRouting",
      fallback: neutralFallback,
    },
    visual: "routing",
  },
  {
    id: "E",
    size: "small",
    title: "If a print fails, you'll know",
    line: {
      text: "Retry it or send it to another printer.",
      claim: "retry",
      fallback: neutralFallback,
    },
    visual: "failure",
  },
  {
    id: "F",
    size: "strip",
    title: "Your prices, your rules",
    line: {
      text: "Set your own rates for black and white, colour and paper size. Customers see the price before paying.",
    },
    visual: "pricing",
  },
] as const satisfies readonly BentoTile[]
