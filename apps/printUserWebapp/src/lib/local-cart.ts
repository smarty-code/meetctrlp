import { STORAGE_KEYS } from "../data/review-constants"

/**
 * Forgets the cart copies kept in sessionStorage for a fast first paint. Called once the server
 * cart is emptied (Clear all, or an order placed), so the next visit never paints old documents.
 */
export function clearStoredCart() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(STORAGE_KEYS.UPLOADED_FILES)
    window.sessionStorage.removeItem(STORAGE_KEYS.CONFIGURED_DOCUMENTS)
    window.sessionStorage.removeItem(STORAGE_KEYS.ORDER_DRAFT)
  } catch {}
}
