/**
 * Sample data for every concept screen (PRD 4.10). Keep identical everywhere.
 * This is the only module that may hold rupee amounts, order IDs or printer names.
 */
export type PaymentState = "paid" | "payAtShop"
export type ColourMode = "colour" | "bw"

export type SampleDocument = {
  readonly name: string
  readonly pages: number
  readonly colour: ColourMode
  readonly copies: number
  readonly size: string
  readonly pageRange: "all" | readonly number[]
  readonly price: number
}

export type SamplePrinter = {
  readonly name: string
  readonly colour: boolean
  readonly mono: boolean
  readonly sizes: readonly string[]
}

const documents = [
  {
    name: "Resume.pdf",
    pages: 3,
    colour: "colour",
    copies: 1,
    size: "A4",
    pageRange: "all",
    price: 30,
  },
  {
    name: "Marksheet.pdf",
    pages: 4,
    colour: "bw",
    copies: 2,
    size: "A4",
    pageRange: [1, 2, 4],
    price: 12,
  },
] as const satisfies readonly SampleDocument[]

const printers = [
  { name: "Xerox Printer 01", colour: true, mono: false, sizes: ["A4", "A3"] },
  { name: "HP LaserJet", colour: false, mono: true, sizes: ["A4"] },
] as const satisfies readonly SamplePrinter[]

export const sampleData = {
  documents,
  printers,
  paperSizes: ["A4", "A3"],
  primaryOrder: { id: "#CP10482", total: 42, payment: "paid" as PaymentState },
  secondaryOrder: {
    id: "#CP10483",
    total: 74,
    payment: "payAtShop" as PaymentState,
  },
  rates: { bw: 2, colour: 10 },
  primaryDocument: documents[0],
  secondaryDocument: documents[1],
  colourPrinter: printers[0],
  monoPrinter: printers[1],
} as const
