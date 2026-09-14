export type ShopStatus = "OPEN" | "BUSY" | "TEMPORARILY_UNAVAILABLE" | "CLOSED"

export interface ShopContext {
  id: string
  name: string
  address: string
  status: ShopStatus
  statusMessage?: string
  estimatedMinutes: number
  startingPriceA4: number
  openTime?: string
  closeTime?: string
}

export interface UploadedFileItem {
  id: string
  file: File
  name: string
  size: number
  type: string
  pageCount?: number
  progress: number
  status: "uploading" | "success" | "error"
  errorMessage?: string
  previewUrl?: string
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
