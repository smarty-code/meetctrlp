import type { PublicShop, QuoteDto } from "./cloud"
import type { OrderPricingBreakdown } from "../types/order"
import type { ConfigurableDocument, PrintConfiguration, ShopContext } from "../types/upload"

export function shopRoutes(slug: string) {
  return {
    home: `/s/${slug}`,
    customize: `/s/${slug}/customize`,
    review: `/s/${slug}/review`,
    payment: `/s/${slug}/payment`,
    orderStatus: `/s/${slug}/order-status`,
  }
}

export function paiseToRupees(paise: number) {
  return paise / 100
}

function todayHours(shop: PublicShop) {
  const day = new Date().getDay()
  return shop.businessHours.find((hour) => hour.dayOfWeek === day)
}

export function mapPublicShopToContext(shop: PublicShop): ShopContext {
  const hours = todayHours(shop)
  const services = [
    shop.capabilities.bwPrinting ? "Black & White A4" : null,
    shop.capabilities.colorPrinting ? "Color printing" : null,
    shop.capabilities.a3Printing ? "A3 printing" : null,
    "Counter collection",
  ].filter((value): value is string => Boolean(value))

  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    address: shop.address ?? "Pickup at the shop counter",
    status: shop.status,
    statusMessage: shop.openNow ? "We're ready to print!" : "The shop is closed right now.",
    estimatedMinutes: shop.estimatedMinutes,
    startingPriceA4: shop.startingPriceA4,
    openTime: hours && !hours.isClosed ? hours.opensAt : undefined,
    closeTime: hours && !hours.isClosed ? hours.closesAt : undefined,
    phone: shop.phone ?? undefined,
    mapUrl: shop.address
      ? `https://maps.google.com/?q=${encodeURIComponent(shop.address)}`
      : undefined,
    services,
    capabilities: {
      colorPrinting: shop.capabilities.colorPrinting,
      a3Printing: shop.capabilities.a3Printing,
    },
    pricing: shop.pricing,
    acceptsCash: shop.acceptsCash,
    acceptsOnline: shop.acceptsOnline,
  }
}

export function toApiColor(mode: PrintConfiguration["colorMode"]) {
  return mode === "color" ? "COLOR" : "BW"
}

export function toApiPaper(size?: string): "A4" | "A3" {
  return size === "A3" ? "A3" : "A4"
}

export function toApiOrientation(value: PrintConfiguration["orientation"]) {
  return value === "landscape" ? "LANDSCAPE" : "PORTRAIT"
}

export function configFromGuestDocument(
  pageSelection: string,
  copies: number,
  colorMode: "BW" | "COLOR",
  paperSize: "A4" | "A3",
  orientation: "PORTRAIT" | "LANDSCAPE",
  pageCount: number,
): PrintConfiguration {
  const selected = pageSelection !== "all"
  const pages = selected
    ? pageSelection
        .split(",")
        .flatMap((token) => {
          const range = token.trim().match(/^(\d+)-(\d+)$/)
          if (range) {
            const start = Number(range[1])
            const end = Number(range[2])
            return Array.from({ length: end - start + 1 }, (_, index) => start + index)
          }
          const page = Number(token.trim())
          return Number.isInteger(page) ? [page] : []
        })
        .filter((page) => page >= 1 && page <= pageCount)
    : []

  return {
    copies,
    colorMode: colorMode === "COLOR" ? "color" : "bw",
    orientation: orientation === "LANDSCAPE" ? "landscape" : "portrait",
    paperSize,
    pageSelection: {
      mode: selected ? "selected" : "all",
      expression: selected ? pageSelection : "",
      pages,
    },
  }
}

export function quoteToPricing(quote: QuoteDto): OrderPricingBreakdown {
  return {
    currency: quote.currency,
    items: quote.items.map((item) => ({
      documentId: item.documentId,
      documentName: item.documentName,
      effectivePageCount: item.billablePages,
      copies: item.copies,
      colorMode: item.colorMode === "COLOR" ? "color" : "bw",
      paperSize: item.paperSize,
      ratePerPage: paiseToRupees(item.unitPricePaise),
      totalAmount: paiseToRupees(item.totalPaise),
    })),
    printCharges: paiseToRupees(quote.totalPaise),
    fees: [],
    taxes: [],
    discounts: [],
    total: paiseToRupees(quote.totalPaise),
    totalSelectedPages: quote.totalSelectedPages,
    totalCopies: quote.totalCopies,
  }
}

export function guestDocumentsToConfigurable(
  documents: Array<{
    id: string
    originalFilename: string
    mimeType: string
    fileSizeBytes: number
    pageCount: number | null
    status: string
    config: {
      colorMode: "BW" | "COLOR"
      copies: number
      paperSize: "A4" | "A3"
      pageSelection: string
      orientation: "PORTRAIT" | "LANDSCAPE"
    }
  }>,
  fileLookup: Map<string, { file?: File; previewUrl?: string }>,
): ConfigurableDocument[] {
  return documents
    .filter((document) => document.status === "READY")
    .map((document) => {
      const cached = fileLookup.get(document.id)
      const pageCount = document.pageCount ?? 1
      return {
        id: document.id,
        name: document.originalFilename,
        size: document.fileSizeBytes,
        type: document.mimeType,
        pageCount,
        previewUrl: cached?.previewUrl,
        file: cached?.file,
        status: "ready" as const,
        configuration: configFromGuestDocument(
          document.config.pageSelection,
          document.config.copies,
          document.config.colorMode,
          document.config.paperSize,
          document.config.orientation,
          pageCount,
        ),
      }
    })
}
