export type ShopStatus = "OPEN" | "BUSY" | "TEMPORARILY_UNAVAILABLE" | "CLOSED"

export interface ShopContext {
  id: string
  name: string
  slug?: string
  address: string
  status: ShopStatus
  statusMessage?: string
  estimatedMinutes: number
  startingPriceA4: number
  /** Today's hours in 12-hour form, as set by the shop (e.g. "9:00 AM – 9:00 PM"). */
  hoursToday?: string
  /** e.g. "Open until 9:00 PM" or "Opens tomorrow at 9:00 AM". */
  openStatusLabel?: string
  weeklyHours?: Array<{ day: string; label: string }>
  phone?: string
  mapUrl?: string
  services?: string[]
  capabilities?: {
    colorPrinting: boolean
    a3Printing: boolean
  }
  pricing?: {
    bwA4PricePaise: number
    colorA4PricePaise: number
    colorA3PricePaise: number
  }
  acceptsCash?: boolean
  acceptsOnline?: boolean
}

export interface UploadedFileItem {
  id: string
  /** Absent for documents restored from the server cart rather than picked in this visit. */
  file?: File
  name: string
  size: number
  type: string
  pageCount?: number
  progress: number
  status: "uploading" | "success" | "error"
  errorMessage?: string
  previewUrl?: string
  /** The upload round this file was sent in; the upload button reports the active round's combined progress. */
  uploadRound?: number
  /** When its upload finished on this page (ms), so a cart read that began earlier does not drop it. */
  completedAt?: number
}

export type ColorMode = "color" | "bw"
export type Orientation = "portrait" | "landscape"
export type PageSelectionMode = "all" | "selected"

export interface PrintConfiguration {
  copies: number
  colorMode: ColorMode
  orientation: Orientation
  paperSize?: string
  pageSelection: {
    mode: PageSelectionMode
    expression: string
    pages: number[]
  }
}

export interface ConfigurableDocument {
  id: string
  name: string
  size: number
  type: string
  pageCount: number
  previewUrl?: string
  file?: File
  status: "ready" | "processing" | "error"
  configuration: PrintConfiguration
}

export interface FAQItem {
  id: string
  question: string
  answer: string
}
