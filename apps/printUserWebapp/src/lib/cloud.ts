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
  }>
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
  storageKey: string
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

type ErrorBody = { error?: string }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  })
  const body = (await response.json().catch(() => ({}))) as T & ErrorBody
  if (!response.ok) {
    throw new Error(body.error ?? `Request failed (${response.status})`)
  }
  return body
}

export function fetchPublicShop(slug: string) {
  return request<{ shop: PublicShop }>(`/api/v1/public/shops/${encodeURIComponent(slug)}`)
}

export function startShopSession(slug: string) {
  return request<{ session: GuestSessionDto; shop: PublicShop }>(
    `/api/v1/public/shops/${encodeURIComponent(slug)}/session`,
    { method: "POST" },
  )
}

export function fetchGuestSession() {
  return request<{ session: GuestSessionDto }>("/api/v1/public/session")
}

export function createDocumentIntent(input: {
  originalFilename: string
  mimeType: string
  fileSizeBytes: number
}) {
  return request<{
    document: GuestDocumentDto
    uploadUrl: string
    storageKey: string
    expiresIn: number
  }>("/api/v1/public/session/documents", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function completeDocumentUpload(docId: string) {
  return request<GuestDocumentDto>(
    `/api/v1/public/session/documents/${encodeURIComponent(docId)}/complete`,
    { method: "POST" },
  )
}

export function deleteGuestDocument(docId: string) {
  return request<{ ok: boolean }>(
    `/api/v1/public/session/documents/${encodeURIComponent(docId)}`,
    { method: "DELETE" },
  )
}

export function saveDocumentConfiguration(
  docId: string,
  input: {
    colorMode: "BW" | "COLOR"
    copies: number
    paperSize: "A4" | "A3"
    orientation?: "PORTRAIT" | "LANDSCAPE"
    pageSelection: { mode: "all" | "selected"; expression?: string }
  },
) {
  return request<{ document: GuestDocumentDto }>(
    `/api/v1/public/session/documents/${encodeURIComponent(docId)}`,
    { method: "PUT", body: JSON.stringify(input) },
  )
}

export function quoteGuestSession() {
  return request<QuoteDto>("/api/v1/public/session/quote", { method: "POST" })
}

export function submitGuestOrder(input: {
  paymentMethod: "CASH" | "ONLINE"
  idempotencyKey: string
  expectedTotalPaise?: number
}) {
  return request<{
    priceChanged: boolean
    quote: QuoteDto
    order: GuestOrderDto | null
  }>("/api/v1/public/session/orders", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function mockConfirmPayment(orderId: string, idempotencyKey: string) {
  return request<GuestOrderDto>(
    `/api/v1/public/session/orders/${encodeURIComponent(orderId)}/payments/mock-confirm`,
    { method: "POST", body: JSON.stringify({ idempotencyKey }) },
  )
}

export function fetchGuestOrder(orderId: string) {
  return request<GuestOrderDto>(
    `/api/v1/public/session/orders/${encodeURIComponent(orderId)}`,
  )
}

export function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
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
