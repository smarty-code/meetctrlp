import { ConfigurableDocument, ShopContext } from "../types/upload"
import {
  OrderDraft,
  OrderPricingBreakdown,
  OrderPricingItem,
  OrderValidationResult,
} from "../types/order"
import { mockShop } from "./mock-shop"
import {
  customizeConfig,
  defaultPrintConfiguration,
} from "./customize-repository"
import { STORAGE_KEYS } from "./review-constants"
import { restoreCachedFile } from "../lib/file-store"
import { mapStoredFilesToDocuments } from "./customize-mapper"
import { fetchGuestSession, quoteGuestSession } from "../lib/cloud"
import { guestDocumentsToConfigurable, mapPublicShopToContext, quoteToPricing } from "../lib/print-user-map"
import { readStoredPublicShop } from "../components/shop-session-provider"

function getEffectivePages(doc: ConfigurableDocument): number {
  if (
    doc.configuration.pageSelection.mode === "selected" &&
    doc.configuration.pageSelection.pages.length > 0
  ) {
    return doc.configuration.pageSelection.pages.length
  }
  return Math.max(1, doc.pageCount)
}

/**
 * Authoritative pricing calculation engine
 * Calculates document subtotals, print charges, fees, taxes, and grand total.
 */
export function calculateOrderPricing(
  documents: ConfigurableDocument[],
  shop: ShopContext
): OrderPricingBreakdown {
  const items: OrderPricingItem[] = documents.map((doc) => {
    const effectivePages = getEffectivePages(doc)
    const ratePerPage =
      doc.configuration.colorMode === "color"
        ? customizeConfig.pricePerPage.color
        : shop.startingPriceA4 ?? customizeConfig.pricePerPage.bw
    const totalAmount = effectivePages * doc.configuration.copies * ratePerPage

    return {
      documentId: doc.id,
      documentName: doc.name,
      effectivePageCount: effectivePages,
      copies: doc.configuration.copies,
      colorMode: doc.configuration.colorMode,
      paperSize: doc.configuration.paperSize || "A4",
      ratePerPage,
      totalAmount,
    }
  })

  const printCharges = items.reduce((sum, item) => sum + item.totalAmount, 0)
  const totalSelectedPages = items.reduce(
    (sum, item) => sum + item.effectivePageCount * item.copies,
    0
  )
  const totalCopies = items.reduce((sum, item) => sum + item.copies, 0)

  // Data-driven fees, taxes, and discounts:
  // For MVP, fees/taxes are only shown if non-zero.
  const fees: { id: string; label: string; amount: number }[] = []
  const taxes: { id: string; label: string; amount: number }[] = []
  const discounts: { id: string; label: string; amount: number }[] = []

  const total = printCharges

  return {
    currency: "INR",
    items,
    printCharges,
    fees,
    taxes,
    discounts,
    total,
    totalSelectedPages,
    totalCopies,
  }
}

/**
 * Validates the draft before allowing transition to Screen 04 (Payment)
 */
export function validateOrderDraft(draft: OrderDraft): OrderValidationResult {
  const errors: string[] = []

  if (!draft.documents || draft.documents.length === 0) {
    errors.push("Your order has no documents. Please upload at least one document.")
    return { isValid: false, errors }
  }

  for (const doc of draft.documents) {
    if (!doc.name) {
      errors.push(`A document is missing a valid filename.`)
      return { isValid: false, errors, invalidDocumentId: doc.id }
    }
    if (doc.configuration.copies < 1) {
      errors.push(`Document "${doc.name}" must have at least 1 copy.`)
      return { isValid: false, errors, invalidDocumentId: doc.id }
    }
    const effectivePages = getEffectivePages(doc)
    if (effectivePages < 1) {
      errors.push(`Document "${doc.name}" has no valid pages selected.`)
      return { isValid: false, errors, invalidDocumentId: doc.id }
    }
  }

  if (draft.pricing.total < 0) {
    errors.push("Invalid calculated order total.")
    return { isValid: false, errors }
  }

  return { isValid: true, errors }
}

function getOrCreateGuestSessionId(): string {
  if (typeof window === "undefined") return "guest-session-ssr"
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEYS.GUEST_SESSION)
    if (existing) return existing
    const generated = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    window.sessionStorage.setItem(STORAGE_KEYS.GUEST_SESSION, generated)
    return generated
  } catch {
    return `guest_${Date.now()}`
  }
}

/**
 * Loads the active order draft from session storage, restoring any cached file handles.
 */
export async function loadOrderDraft(): Promise<OrderDraft> {
  const storedShop = readStoredPublicShop()
  const shop = storedShop ? mapPublicShopToContext(storedShop) : mockShop
  const sessionId = getOrCreateGuestSessionId()
  let documents: ConfigurableDocument[] = []

  try {
    const { session } = await fetchGuestSession()
    const fileLookup = new Map<string, { file?: File; previewUrl?: string }>()
    if (typeof window !== "undefined") {
      for (const document of session.documents) {
        const cached = await restoreCachedFile(document.id)
        if (cached) fileLookup.set(document.id, cached)
      }
    }
    documents = guestDocumentsToConfigurable(session.documents, fileLookup)
  } catch {
    if (typeof window !== "undefined") {
      try {
        const storedConfigured = window.sessionStorage.getItem(STORAGE_KEYS.CONFIGURED_DOCUMENTS)
        if (storedConfigured) {
          documents = JSON.parse(storedConfigured)
        } else {
          const storedUploaded = window.sessionStorage.getItem(STORAGE_KEYS.UPLOADED_FILES)
          if (storedUploaded) {
            documents = mapStoredFilesToDocuments(JSON.parse(storedUploaded), "doc")
          }
        }
      } catch (error) {
        console.warn("Failed reading order draft from storage:", error)
      }
    }
  }

  const restoredDocs = await Promise.all(
    documents.map(async (doc) => {
      const config = { ...defaultPrintConfiguration, ...doc.configuration }
      if (doc.id) {
        const cached = await restoreCachedFile(doc.id)
        if (cached) {
          return { ...doc, file: cached.file, previewUrl: cached.url, configuration: config }
        }
      }
      return { ...doc, configuration: config }
    }),
  )

  let pricing = calculateOrderPricing(restoredDocs, shop)
  try {
    pricing = quoteToPricing(await quoteGuestSession())
  } catch {
    // Keep the local estimate until the quote endpoint is reachable.
  }

  return {
    orderId: `draft-${sessionId}`,
    shop,
    documents: restoredDocs,
    pricing,
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      guestSessionId: sessionId,
      idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isPriceAuthoritative: true,
    },
  }
}

/**
 * Persists the current draft to session storage
 */
export function saveOrderDraft(draft: OrderDraft): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(
      STORAGE_KEYS.ORDER_DRAFT,
      JSON.stringify(draft)
    )
    window.sessionStorage.setItem(
      STORAGE_KEYS.CONFIGURED_DOCUMENTS,
      JSON.stringify(draft.documents)
    )
  } catch (e) {
    console.warn("Could not save order draft:", e)
  }
}

/**
 * Revalidates price with authoritative backend simulation before proceeding to Payment
 */
export async function refreshPriceAuthoritatively(
  draft: OrderDraft
): Promise<{
  pricing: OrderPricingBreakdown
  hasChanged: boolean
  previousTotal: number
}> {
  const previousTotal = draft.pricing.total
  let freshPricing = calculateOrderPricing(draft.documents, draft.shop)
  try {
    freshPricing = quoteToPricing(await quoteGuestSession())
  } catch {
    // Keep the local estimate if the quote request fails.
  }
  return {
    pricing: freshPricing,
    hasChanged: freshPricing.total !== previousTotal,
    previousTotal,
  }
}
