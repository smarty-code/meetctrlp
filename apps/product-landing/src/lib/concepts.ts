import { conceptCopy } from "@/content/concepts"
import {
  sampleData,
  type ColourMode,
  type PaymentState,
  type SampleDocument,
} from "@/content/sampleData"
import { fill, formatRupees } from "@/lib/format"

const { common, status } = conceptCopy

export function colourLabel(mode: ColourMode): string {
  return mode === "colour" ? common.colour : common.bw
}

export function copiesLabel(count: number): string {
  return fill(count === 1 ? common.copiesOne : common.copiesOther, { count })
}

export function pageRangeLabel(range: SampleDocument["pageRange"]): string {
  return range === "all"
    ? common.allPages
    : fill(common.pagesList, { list: range.join(", ") })
}

/** "3 pages · Colour · 1 copy · A4 · All pages" */
export function documentSummary(doc: SampleDocument): string {
  return [
    fill(common.pageCount, { count: doc.pages }),
    colourLabel(doc.colour),
    copiesLabel(doc.copies),
    doc.size,
    pageRangeLabel(doc.pageRange),
  ].join(` ${conceptCopy.glyphs.separator} `)
}

export function paymentLabel(payment: PaymentState): string {
  return payment === "paid" ? status.paid : status.payAtShop
}

/** Values for `{slot}` placeholders in concept accessibility text. */
export const conceptSlots = {
  id: sampleData.primaryOrder.id,
  total: formatRupees(sampleData.primaryOrder.total),
  document: sampleData.primaryDocument.name,
  colourPrinter: sampleData.colourPrinter.name,
  monoPrinter: sampleData.monoPrinter.name,
} as const

export function describe(template: string): string {
  return fill(template, conceptSlots)
}
