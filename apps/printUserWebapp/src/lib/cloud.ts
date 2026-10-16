import { clearStoredCart } from "./local-cart"

const API_BASE = ""

export type PublicShop = {
  id: string
  name: string
  slug: string
  status: "OPEN" | "CLOSED" | "TEMPORARILY_UNAVAILABLE"
  shopStatus: string
  phone: string | null
  email: string | null
  address: string | null
  addressParts: {
    line1: string | null
    line2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
    country: string | null
  }
  openNow: boolean
  estimatedMinutes: number
  startingPriceA4: number
  capabilities: {
    bwPrinting: true
    colorPrinting: boolean
    a4Printing: true
    a3Printing: boolean
  }
  pricing: {
    currency: "INR"
    unit: "PER_PAGE"
    bwA4PricePaise: number
    colorA4PricePaise: number
    colorA3PricePaise: number
  }
  businessHours: Array<{
    dayOfWeek: number
    opensAt: string
    closesAt: string
    isClosed: boolean
    isOpen24Hours: boolean
    /** 12-hour display text from the server, e.g. "9:00 AM – 9:00 PM". */
    label: string
  }>
  /** Computed by the server in shop time, e.g. "Open until 9:00 PM". */
  openStatusLabel: string
  todayHoursLabel: string
  isOpen24x7: boolean
  acceptsCash: boolean
  acceptsOnline: boolean
}

export type GuestDocumentDto = {
  id: string
  originalFilename: string
  mimeType: "application/pdf" | "image/jpeg" | "image/png"
  fileSizeBytes: number
  pageCount: number | null
  sha256Hash: string | null
  /** Not sent in session responses; the server keeps storage keys to itself. */
  storageKey?: string
  status: "UPLOADING" | "READY" | "FAILED"
  config: {
    colorMode: "BW" | "COLOR"
    copies: number
    paperSize: "A4" | "A3"
    pageSelection: string
    billablePages: number
    orientation: "PORTRAIT" | "LANDSCAPE"
  }
}

export type GuestSessionDto = {
  id: string
  shopId: string
  shopSlug: string
  documents: GuestDocumentDto[]
  activeOrderId: string | null
  expiresAt: string | null
}

export type QuoteDto = {
  currency: "INR"
  items: Array<{
    documentId: string
    documentName: string
    billablePages: number
    copies: number
    colorMode: "BW" | "COLOR"
    paperSize: "A4" | "A3"
    unitPricePaise: number
    totalPaise: number
  }>
  totalPaise: number
  totalSelectedPages: number
  totalCopies: number
}

export type GuestOrderDto = {
  id: string
  orderNumber: string
  shopId: string
  printUserId: string
  status: string
  pickupCode: string
  amounts: {
    subtotalMinorUnits: number
    taxMinorUnits: number
    totalMinorUnits: number
  }
  payment: {
    method: "CASH" | "ONLINE"
    status: "PENDING" | "PAID"
  }
  documents: Array<{
    id: string
    originalFilename: string
    pageCount: number
    copies: number
    colorMode: "BW" | "COLOR"
    paperSize: "A4" | "A3"
    unitPricePaise: number
    totalPaise: number
    mimeType?: string
    config?: {
      pageSelection?: string
      billablePages?: number
    }
  }>
  items: Array<{
    description: string
    quantity: number
    unitPricePaise: number
    totalPricePaise: number
  }>
  rejection: {
    rejectedAt: string | null
    reason: string | null
    category: string | null
  }
  lifecycle: {
    submittedAt: string | null
    acceptedAt: string | null
    readyAt: string | null
    completedAt: string | null
  }
  createdAt: string | null
  updatedAt: string | null
}

/**
 * The customer-safe copy of an order: what the tracking page's listener reads from
 * orderTracking/{orderId}, and what the one-off fetch returns. Times are ISO strings.
 */
export type OrderTrackingDto = {
  orderId: string
  shopId: string
  printUserId: string
  orderNumber: string
  pickupCode: string
  status: string
  payment: { method: "CASH" | "ONLINE"; status: "PENDING" | "PAID" }
  totalPaise: number
  items: Array<{
    name: string
    pageCount: number
    billablePages: number
    copies: number
    colorMode: "BW" | "COLOR"
    paperSize: "A4" | "A3"
    totalPaise: number
    mimeType: string | null
  }>
  rejectionReason: string | null
  times: {
    submittedAt: string | null
    paidAt: string | null
    acceptedAt: string | null
    printingAt: string | null
    readyAt: string | null
    completedAt: string | null
    rejectedAt: string | null
    cancelledAt: string | null
  }
  updatedAt: string | null
}

type ErrorBody = { error?: string }

/** A response the server (or the hosting platform in front of it) answered with an error status. */
export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

// The shop this page's guest session belongs to, kept to start the session again after a 401.
let currentShopSlug: string | null = null
let restartingSession: Promise<unknown> | null = null

/** One session restart for any number of requests that hit a 401 at the same time. */
function restartShopSession(slug: string) {
  restartingSession ??= startShopSession(slug).finally(() => {
    restartingSession = null
  })
  return restartingSession
}

async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  })
  // A cart route's 401 means the guest cookie is gone: it expired, or its signing key changed.
  // Start the session again once and retry, rather than failing every request until a reload.
  if (response.status === 401 && !isRetry && currentShopSlug && path.startsWith("/api/v1/public/session")) {
    await restartShopSession(currentShopSlug)
    return request<T>(path, init, true)
  }
  const body = (await response.json().catch(() => ({}))) as T & ErrorBody
  if (!response.ok) {
    throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status)
  }
  return body
}

// The last guest cart the server sent (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 11.2). Every
// cart-changing response below updates it, so pages reuse it across client-side navigation
// instead of reading the cart again. Module state: a hard load starts empty.
let lastSession: GuestSessionDto | null = null

function rememberSession(session: GuestSessionDto) {
  lastSession = session
}

function rememberDocument(document: GuestDocumentDto) {
  if (!lastSession) return
  const exists = lastSession.documents.some((entry) => entry.id === document.id)
  lastSession = {
    ...lastSession,
    documents: exists
      ? lastSession.documents.map((entry) => (entry.id === document.id ? document : entry))
      : [...lastSession.documents, document],
  }
}

function forgetDocument(docId: string) {
  if (!lastSession) return
  lastSession = {
    ...lastSession,
    documents: lastSession.documents.filter((entry) => entry.id !== docId),
  }
}

/**
 * The guest cart: the one held from the last response, or one read from the server when there
 * is none (a hard load before the session start finished). `fresh` forces the read, for
 * recovering after a failed write.
 */
export async function loadGuestSession(options: { fresh?: boolean } = {}) {
  if (lastSession && !options.fresh) return lastSession
  const { session } = await request<{ session: GuestSessionDto }>("/api/v1/public/session")
  rememberSession(session)
  return session
}

export function fetchPublicShop(slug: string) {
  return request<{ shop: PublicShop }>(`/api/v1/public/shops/${encodeURIComponent(slug)}`)
}

export async function startShopSession(slug: string) {
  // firebaseToken: a custom token for this guest, used only by the tracking page's listener.
  const body = await request<{ session: GuestSessionDto; shop: PublicShop; firebaseToken: string | null }>(
    `/api/v1/public/shops/${encodeURIComponent(slug)}/session`,
    { method: "POST" },
  )
  currentShopSlug = body.shop.slug
  rememberSession(body.session)
  return body
}

export async function createDocumentIntent(input: {
  originalFilename: string
  mimeType: string
  fileSizeBytes: number
}) {
  const body = await request<{
    document: GuestDocumentDto
    uploadUrl: string
    storageKey: string
    expiresIn: number
  }>("/api/v1/public/session/documents", {
    method: "POST",
    body: JSON.stringify(input),
  })
  rememberDocument(body.document)
  return body
}

export async function completeDocumentUpload(docId: string) {
  const document = await request<GuestDocumentDto>(
    `/api/v1/public/session/documents/${encodeURIComponent(docId)}/complete`,
    { method: "POST" },
  )
  rememberDocument(document)
  return document
}

/** Cart errors sent as the response's `error` (PrintUserCartErrorCode in @ctrlp/schemas). */
export const CART_ERROR = {
  /** 409 on delete: the document is already in the placed order. */
  alreadyOrdered: "ALREADY_ORDERED",
  /** 409 on submit: a cart file is still uploading. */
  stillUploading: "DOCUMENTS_STILL_UPLOADING",
} as const

/** The delete was refused because the document is already in the guest's placed order. */
export function isAlreadyOrderedError(error: unknown) {
  return error instanceof ApiError && error.status === 409 && error.message === CART_ERROR.alreadyOrdered
}

/** Idempotent: `removed` is false when the document was already gone from the cart. */
export async function deleteGuestDocument(docId: string) {
  const body = await request<{ ok: true; removed: boolean }>(
    `/api/v1/public/session/documents/${encodeURIComponent(docId)}`,
    { method: "DELETE" },
  )
  forgetDocument(docId)
  return body
}

/** Clear all: empties the server cart, uploads still in flight included. A placed order is kept. */
export async function clearGuestCart() {
  const body = await request<{ ok: true; removed: number }>("/api/v1/public/session/documents", {
    method: "DELETE",
  })
  if (lastSession) lastSession = { ...lastSession, documents: [] }
  return body
}

export async function saveDocumentConfiguration(
  docId: string,
  input: {
    colorMode: "BW" | "COLOR"
    copies: number
    paperSize: "A4" | "A3"
    orientation?: "PORTRAIT" | "LANDSCAPE"
    pageSelection: { mode: "all" | "selected"; expression?: string }
  },
) {
  const body = await request<{ document: GuestDocumentDto }>(
    `/api/v1/public/session/documents/${encodeURIComponent(docId)}`,
    { method: "PUT", body: JSON.stringify(input) },
  )
  rememberDocument(body.document)
  return body
}

export async function saveDocumentConfigurations(
  documents: Array<Parameters<typeof saveDocumentConfiguration>[1] & { documentId: string }>,
) {
  const body = await request<{ documents: GuestDocumentDto[] }>("/api/v1/public/session/documents", {
    method: "PUT",
    body: JSON.stringify({ documents }),
  })
  body.documents.forEach(rememberDocument)
  return body
}

export function quoteGuestSession() {
  return request<QuoteDto>("/api/v1/public/session/quote", { method: "POST" })
}

export async function submitGuestOrder(input: {
  paymentMethod: "CASH" | "ONLINE"
  idempotencyKey: string
  expectedTotalPaise?: number
}) {
  const body = await request<{
    priceChanged: boolean
    quote: QuoteDto
    order: GuestOrderDto | null
  }>("/api/v1/public/session/orders", {
    method: "POST",
    body: JSON.stringify(input),
  })
  // Placing the order takes its documents out of the cart; the next order reads the cart again.
  if (body.order) {
    lastSession = null
    clearStoredCart()
  }
  return body
}

export function mockConfirmPayment(orderId: string, idempotencyKey: string) {
  return request<GuestOrderDto>(
    `/api/v1/public/session/orders/${encodeURIComponent(orderId)}/payments/mock-confirm`,
    { method: "POST", body: JSON.stringify({ idempotencyKey }) },
  )
}

/**
 * Cancels the guest's order while it is SUBMITTED and unpaid; its files are deleted. Returns the
 * tracking copy. 409 `ORDER_NOT_CANCELLABLE` once the shop has it, `ORDER_ALREADY_PAID` once paid.
 */
export function cancelGuestOrder(orderId: string) {
  return request<OrderTrackingDto>(
    `/api/v1/public/session/orders/${encodeURIComponent(orderId)}/cancel`,
    { method: "POST" },
  )
}

/** One read of the order's tracking copy: the fallback when the live listener isn't available. */
export function fetchOrderTracking(orderId: string) {
  return request<OrderTrackingDto>(
    `/api/v1/public/session/orders/${encodeURIComponent(orderId)}`,
  )
}

/** The shopper cancelled this upload (Cancel Upload, Remove, or Clear all). Not a failure to show. */
export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled")
    this.name = "UploadCancelledError"
  }
}

export function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadCancelledError())
      return
    }
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    signal?.addEventListener("abort", abort, { once: true })
    xhr.onloadend = () => signal?.removeEventListener("abort", abort)
    xhr.onabort = () => reject(new UploadCancelledError())
    xhr.open("PUT", uploadUrl)
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }
      reject(new Error(`storage upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error("storage upload failed"))
    xhr.send(file)
  })
}
