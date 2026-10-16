import { shopError, shopLog } from "./debug"
import {
  looksLikeEmail,
  type AuthSession,
  type CloudPrintJob,
  type OrderAutomation,
  type ShopOrder,
  type ShopStaffMember,
  type ShopUser,
} from "./protocol"

export const serverBaseUrl = (
  import.meta.env.VITE_SERVER_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "")

type ErrorBody = { error?: string }

/** Supplies the API bearer token. `forceRefresh` asks for a new one after a 401. Null: nobody signed in. */
export type TokenSource = (forceRefresh: boolean) => Promise<string | null>

let tokenSource: TokenSource = async () => null
let onSignedOut: () => void = () => undefined

/**
 * The window never keeps tokens itself: the agent owns this PC's login and hands out ID tokens
 * (implementation plan 8.2). On a 401 the token is refreshed once and the call retried; a second 401
 * means the login is gone, and `signedOut` shows the login screen.
 */
export function configureCloudAuth(source: TokenSource, signedOut: () => void) {
  tokenSource = source
  onSignedOut = signedOut
}

export class CloudError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = "CloudError"
  }
}

async function send<T>(path: string, init: RequestInit, token: string | null) {
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  shopLog("cloud", init.method ?? "GET", path)
  const response = await fetch(`${serverBaseUrl}${path}`, { ...init, headers })
  const body = (await response.json().catch(() => ({}))) as T & ErrorBody
  return { response, body }
}

async function request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...rest } = init
  let token = auth ? await tokenSource(false) : null
  let { response, body } = await send<T>(path, rest, token)

  if (auth && response.status === 401) {
    token = await tokenSource(true).catch(() => null)
    if (token) {
      ;({ response, body } = await send<T>(path, rest, token))
    }
    if (response.status === 401) {
      onSignedOut()
    }
  }

  if (!response.ok) {
    const message = body.error ?? `Request failed (${response.status})`
    shopError("cloud", path, response.status, message)
    throw new CloudError(message, response.status)
  }

  return body
}

function query(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value))
    }
  }
  const text = search.toString()
  return text ? `?${text}` : ""
}

export function registerOwner(input: {
  name: string
  shopName: string
  password: string
  identifier: string
}) {
  const identifier = input.identifier.trim()
  return request<AuthSession>("/api/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify({
      name: input.name.trim(),
      shopName: input.shopName.trim(),
      password: input.password,
      ...(looksLikeEmail(identifier) ? { email: identifier } : { phone: identifier }),
    }),
  })
}

export function loginOwner(identifier: string, password: string) {
  return request<AuthSession>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  })
}

/** Signs out this PC only; the same login stays signed in on other PCs (implementation plan 5.1). */
export function logoutSession() {
  return request<{ ok?: boolean }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ allDevices: false }),
  })
}

export function fetchCurrentUser() {
  return request<{ user: ShopUser }>("/api/auth/me")
}

export function fetchShopProfile() {
  return request<{ shop: import("./protocol").ShopProfile }>("/api/v1/shops/profile")
}

export function updateShopProfile(input: {
  name: string
  phone: string | null
  email: string | null
  address: import("./protocol").ShopAddress
}) {
  return request<{ shop: import("./protocol").ShopProfile }>("/api/v1/shops/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function fetchShopConfig(shopId: string) {
  return request<import("./protocol").ShopConfig>(`/api/v1/shops/${shopId}/pricing`)
}

export function updateShopPricing(
  shopId: string,
  input: { bwA4PricePaise: number; colorA4PricePaise: number; colorA3PricePaise: number }
) {
  return request<import("./protocol").ShopConfig>(`/api/v1/shops/${shopId}/pricing`, {
    method: "PUT",
    body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
  })
}

export function updateShopHours(shopId: string, businessHours: import("./protocol").ShopBusinessHour[]) {
  return request<import("./protocol").ShopConfig>(`/api/v1/shops/${shopId}/hours`, {
    method: "PUT",
    body: JSON.stringify({ businessHours, idempotencyKey: crypto.randomUUID() }),
  })
}

export function updateShopCapabilities(shopId: string, input: { colorPrinting: boolean; a3Printing: boolean }) {
  return request<import("./protocol").ShopConfig>(`/api/v1/shops/${shopId}/capabilities`, {
    method: "PUT",
    body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
  })
}

export function fetchOrderAutomation(shopId: string) {
  return request<OrderAutomation>(`/api/v1/shops/${shopId}/automation`)
}

export function updateOrderAutomation(shopId: string, automation: OrderAutomation) {
  return request<OrderAutomation>(`/api/v1/shops/${shopId}/automation`, {
    method: "PUT",
    body: JSON.stringify(automation),
  })
}

export function fetchShopStaff() {
  return request<{ staff: ShopStaffMember[] }>("/api/v1/shops/staff")
}

export function registerDevice(input: {
  deviceIdentifier: string
  hostname: string
  osVersion: string
  appVersion: string
  agentVersion: string
}) {
  return request<{ deviceId: string; status: "ONLINE" }>("/api/v1/devices/register", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

/** Marks this PC and its printers OFFLINE, so routing stops sending them work. */
export function markDeviceOffline(deviceId: string) {
  return request<{ deviceId: string; status: "OFFLINE" }>("/api/v1/devices/offline", {
    method: "POST",
    body: JSON.stringify({ deviceId }),
  })
}

export function syncShopPrinters(shopId: string, input: { agentId: string; printers: Array<Record<string, unknown>> }) {
  return request<{ printers: import("./protocol").CloudPrinter[] }>(`/api/v1/shops/${shopId}/printers`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function listShopPrinters(shopId: string) {
  return request<{ printers: import("./protocol").CloudPrinter[] }>(`/api/v1/shops/${shopId}/printers`)
}

export function patchShopPrinter(
  shopId: string,
  printerId: string,
  input: { isDefault?: boolean; enabled?: boolean; offered?: { color?: boolean; a3?: boolean } }
) {
  return request<import("./protocol").CloudPrinter>(`/api/v1/shops/${shopId}/printers/${printerId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function sendPrinterTelemetry(
  shopId: string,
  printerId: string,
  input: {
    previousStatus: string
    newStatus: string
    errorDescription?: string | null
    activeSpoolJobs: number
  }
) {
  return request<{ printerId: string; status: string }>(`/api/v1/shops/${shopId}/printers/${printerId}/telemetry`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export type BoardResponse = {
  /** True: replace the board. False: merge these changes. */
  full: boolean
  orders: ShopOrder[]
  jobs: CloudPrintJob[]
  /** Pass back as `since` on the next fetch. */
  cursor: string
}

/** Active orders and unfinished jobs, or only what changed since `since` (implementation plan 6.4). */
export function fetchBoard(shopId: string, since?: string | null) {
  return request<BoardResponse>(`/api/v1/shops/${shopId}/board${query({ since })}`)
}

export type OrderPage = { orders: ShopOrder[]; nextCursor: string | null }

/** Paged history, newest first. Dates are shop-time days (`YYYY-MM-DD`), resolved on the server. */
export function fetchOrderHistory(
  shopId: string,
  input: { statuses?: ShopOrder["status"][]; from?: string; to?: string; cursor?: string | null; limit?: number } = {}
) {
  return request<OrderPage>(
    `/api/v1/shops/${shopId}/orders${query({
      status: input.statuses?.join(","),
      from: input.from,
      to: input.to,
      cursor: input.cursor,
      limit: input.limit,
    })}`
  )
}

/** Exact matches on order number, pickup code, phone digits or filename words (3+ characters). */
export function searchShopOrders(shopId: string, q: string, cursor?: string | null) {
  return request<OrderPage>(`/api/v1/shops/${shopId}/orders/search${query({ q, cursor })}`)
}

export function getShopOrder(shopId: string, orderId: string) {
  return request<ShopOrder>(`/api/v1/shops/${shopId}/orders/${orderId}`)
}

export function transitionShopOrder(
  shopId: string,
  orderId: string,
  action: "accept" | "printing" | "ready" | "complete",
  currentStatus: ShopOrder["status"],
  agentId?: string | null
) {
  return request<ShopOrder>(`/api/v1/shops/${shopId}/orders/${orderId}/${action}`, {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      currentStatus,
      // On accept, this PC's printers are tried first for the jobs.
      ...(action === "accept" && agentId ? { agentId } : {}),
    }),
  })
}

export function rejectShopOrder(
  shopId: string,
  orderId: string,
  currentStatus: ShopOrder["status"],
  reason: string,
  category: "OUT_OF_PAPER" | "INVALID_DOCUMENT" | "HARDWARE_FAULT" | "SHOP_CLOSED" | "OTHER" = "OTHER"
) {
  return request<ShopOrder>(`/api/v1/shops/${shopId}/orders/${orderId}/reject`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), currentStatus, reason, category }),
  })
}

export function recordCashPayment(shopId: string, orderId: string, cashTenderedPaise: number) {
  return request<ShopOrder>(`/api/v1/shops/${shopId}/orders/${orderId}/cash`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), cashTenderedPaise }),
  })
}

export function listOrderPrintJobs(shopId: string, orderId: string) {
  return request<{ jobs: CloudPrintJob[] }>(`/api/v1/shops/${shopId}/orders/${orderId}/jobs`)
}

export function dispatchOrderPrintJob(
  shopId: string,
  orderId: string,
  input: {
    printerId: string
    documentId: string
    overrides?: {
      colorMode?: "BW" | "COLOR"
      copies?: number
      paperSize?: "A4" | "A3"
      pageSelection?: string
      inputTray?: string
    }
  }
) {
  return request<{ jobId: string; status: "QUEUED"; resolvedSettings: Record<string, unknown> }>(
    `/api/v1/shops/${shopId}/orders/${orderId}/jobs`,
    { method: "POST", body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }) }
  )
}

export function routeOrderPrintJob(shopId: string, input: { colorMode: "BW" | "COLOR"; paperSize: "A4" | "A3" }) {
  return request<{ printerId: string; name: string; activeSpoolJobs: number; status: string }>(
    `/api/v1/shops/${shopId}/routing`,
    { method: "POST", body: JSON.stringify(input) }
  )
}

/**
 * Puts a cloud job back in the queue with a new lease, optionally on another printer. Also rescues a
 * job stuck DISPATCHING for 15 minutes on a PC that stopped syncing.
 */
export function retryOrderPrintJob(shopId: string, orderId: string, jobId: string, printerId?: string) {
  return request<CloudPrintJob>(`/api/v1/shops/${shopId}/orders/${orderId}/jobs/${jobId}/retry`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), printerId }),
  })
}

/**
 * Cancels a waiting, failed, or stuck (15 minutes) cloud job; a PC that holds it drops it on its next sync.
 * Answers 409 PRINT_JOB_STILL_ACTIVE while a live PC holds it. The document can then be dispatched again.
 */
export function cancelOrderPrintJob(shopId: string, orderId: string, jobId: string, reason?: string) {
  return request<CloudPrintJob>(`/api/v1/shops/${shopId}/orders/${orderId}/jobs/${jobId}/cancel`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  })
}

export async function getDocumentDownloadUrl(shopId: string, orderId: string, docId: string) {
  return request<{ url: string; sha256Hash: string; mimeType?: string; pageCount: number; expiresIn: number }>(
    `/api/v1/shops/${shopId}/orders/${orderId}/documents/${docId}/download-url`
  )
}
