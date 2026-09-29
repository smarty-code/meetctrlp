import { shopError, shopLog } from "./debug"
import {
  looksLikeEmail,
  type AuthSession,
  type CloudPrintJob,
  type OrderAutomation,
  type OrderStreamEvent,
  type ShopOrder,
  type ShopStaffMember,
  type ShopUser,
} from "./protocol"

export const serverBaseUrl = (
  import.meta.env.VITE_SERVER_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "")

type ErrorBody = { error?: string }

async function request<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("Content-Type", "application/json")
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`)
  }

  const url = `${serverBaseUrl}${path}`
  shopLog("cloud", init.method ?? "GET", path)
  const response = await fetch(url, {
    ...init,
    headers,
  })
  const body = (await response.json().catch(() => ({}))) as T & ErrorBody

  if (!response.ok) {
    const message = body.error ?? `Request failed (${response.status})`
    shopError("cloud", path, response.status, message)
    throw new Error(message)
  }

  return body
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
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  })
}

export function refreshSession(refreshToken: string) {
  return request<AuthSession>("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  })
}

export function logoutSession(token: string) {
  return request<{ ok?: boolean }>("/api/auth/logout", {
    method: "POST",
    token,
    body: "{}",
  })
}

export function fetchCurrentUser(token: string) {
  return request<{ user: ShopUser }>("/api/auth/me", { token })
}

export function fetchShopProfile(token: string) {
  return request<{ shop: import("./protocol").ShopProfile }>("/api/v1/shops/profile", { token })
}

export function updateShopProfile(
  token: string,
  input: {
    name: string
    phone: string | null
    email: string | null
    address: import("./protocol").ShopAddress
  }
) {
  return request<{ shop: import("./protocol").ShopProfile }>("/api/v1/shops/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify(input),
  })
}

export function fetchShopConfig(token: string, shopId: string) {
  return request<import("./protocol").ShopConfig>(`/api/v1/shops/${shopId}/pricing`, { token })
}

export function updateShopPricing(
  token: string,
  shopId: string,
  input: { bwA4PricePaise: number; colorA4PricePaise: number; colorA3PricePaise: number }
) {
  return request<import("./protocol").ShopConfig>(`/api/v1/shops/${shopId}/pricing`, {
    method: "PUT",
    token,
    body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
  })
}

export function updateShopHours(
  token: string,
  shopId: string,
  businessHours: import("./protocol").ShopBusinessHour[]
) {
  return request<import("./protocol").ShopConfig>(`/api/v1/shops/${shopId}/hours`, {
    method: "PUT",
    token,
    body: JSON.stringify({ businessHours, idempotencyKey: crypto.randomUUID() }),
  })
}

export function updateShopCapabilities(
  token: string,
  shopId: string,
  input: { colorPrinting: boolean; a3Printing: boolean }
) {
  return request<import("./protocol").ShopConfig>(`/api/v1/shops/${shopId}/capabilities`, {
    method: "PUT",
    token,
    body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
  })
}

export function fetchOrderAutomation(token: string, shopId: string) {
  return request<OrderAutomation>(`/api/v1/shops/${shopId}/automation`, { token })
}

export function updateOrderAutomation(token: string, shopId: string, automation: OrderAutomation) {
  return request<OrderAutomation>(`/api/v1/shops/${shopId}/automation`, {
    method: "PUT",
    token,
    body: JSON.stringify(automation),
  })
}

export function fetchShopStaff(token: string) {
  return request<{ staff: ShopStaffMember[] }>("/api/v1/shops/staff", { token })
}

export function registerDevice(
  token: string,
  input: {
    deviceIdentifier: string
    hostname: string
    osVersion: string
    appVersion: string
    agentVersion: string
  }
) {
  return request<{
    deviceId: string
    agentCredential?: string
    heartbeatIntervalSeconds: number
    status: "ONLINE"
  }>("/api/v1/devices/register", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  })
}

export function sendDeviceHeartbeat(
  token: string,
  input: {
    deviceId: string
    memoryWorkingSetBytes?: number
    spoolerJobCount?: number
    onlinePrinterCount?: number
  }
) {
  return request<{
    deviceId: string
    status: "ONLINE"
    heartbeatIntervalSeconds: number
  }>("/api/v1/devices/heartbeat", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  })
}

export function markDeviceOffline(token: string, deviceId: string) {
  return request<{ deviceId: string; status: "OFFLINE" }>("/api/v1/devices/offline", {
    method: "POST",
    token,
    body: JSON.stringify({ deviceId }),
  })
}

export function syncShopPrinters(
  token: string,
  shopId: string,
  input: {
    agentId: string
    printers: Array<Record<string, unknown>>
  }
) {
  return request<{ printers: import("./protocol").CloudPrinter[] }>(
    `/api/v1/shops/${shopId}/printers`,
    {
      method: "POST",
      token,
      body: JSON.stringify(input),
    }
  )
}

export function listShopPrinters(token: string, shopId: string) {
  return request<{ printers: import("./protocol").CloudPrinter[] }>(
    `/api/v1/shops/${shopId}/printers`,
    { token }
  )
}

export function patchShopPrinter(
  token: string,
  shopId: string,
  printerId: string,
  input: { isDefault?: boolean; enabled?: boolean; offered?: { color?: boolean; a3?: boolean } }
) {
  return request<import("./protocol").CloudPrinter>(
    `/api/v1/shops/${shopId}/printers/${printerId}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(input),
    }
  )
}

export function sendPrinterTelemetry(
  token: string,
  shopId: string,
  printerId: string,
  input: {
    previousStatus: string
    newStatus: string
    errorDescription?: string | null
    activeSpoolJobs: number
  }
) {
  return request<{ printerId: string; status: string }>(
    `/api/v1/shops/${shopId}/printers/${printerId}/telemetry`,
    {
      method: "POST",
      token,
      body: JSON.stringify(input),
    }
  )
}

export function listShopOrders(token: string, shopId: string) {
  return request<{ orders: ShopOrder[] }>(`/api/v1/shops/${shopId}/orders`, { token })
}

export function getShopOrder(token: string, shopId: string, orderId: string) {
  return request<ShopOrder>(`/api/v1/shops/${shopId}/orders/${orderId}`, { token })
}

export function transitionShopOrder(
  token: string,
  shopId: string,
  orderId: string,
  action: "accept" | "printing" | "ready" | "complete",
  currentStatus: ShopOrder["status"]
) {
  return request<ShopOrder>(`/api/v1/shops/${shopId}/orders/${orderId}/${action}`, {
    method: "POST",
    token,
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), currentStatus }),
  })
}

export function rejectShopOrder(
  token: string,
  shopId: string,
  orderId: string,
  currentStatus: ShopOrder["status"],
  reason: string,
  category: "OUT_OF_PAPER" | "INVALID_DOCUMENT" | "HARDWARE_FAULT" | "SHOP_CLOSED" | "OTHER" = "OTHER"
) {
  return request<ShopOrder>(`/api/v1/shops/${shopId}/orders/${orderId}/reject`, {
    method: "POST",
    token,
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      currentStatus,
      reason,
      category,
    }),
  })
}

export function recordCashPayment(
  token: string,
  shopId: string,
  orderId: string,
  cashTenderedPaise: number
) {
  return request<ShopOrder>(`/api/v1/shops/${shopId}/orders/${orderId}/cash`, {
    method: "POST",
    token,
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), cashTenderedPaise }),
  })
}

export function listOrderPrintJobs(token: string, shopId: string, orderId: string) {
  return request<{ jobs: CloudPrintJob[] }>(`/api/v1/shops/${shopId}/orders/${orderId}/jobs`, { token })
}

export function dispatchOrderPrintJob(
  token: string,
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
    {
      method: "POST",
      token,
      body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
    }
  )
}

export function routeOrderPrintJob(
  token: string,
  shopId: string,
  input: { colorMode: "BW" | "COLOR"; paperSize: "A4" | "A3" }
) {
  return request<{ printerId: string; name: string; activeSpoolJobs: number; status: string }>(
    `/api/v1/shops/${shopId}/routing`,
    {
      method: "POST",
      token,
      body: JSON.stringify(input),
    }
  )
}

export function updateOrderPrintJob(
  token: string,
  shopId: string,
  orderId: string,
  jobId: string,
  input: {
    status: CloudPrintJob["status"]
    pagesPrinted?: number
    spoolerJobId?: number | null
    errorCode?: string | null
    errorMessage?: string | null
  }
) {
  return request<CloudPrintJob>(`/api/v1/shops/${shopId}/orders/${orderId}/jobs/${jobId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() }),
  })
}

export function retryOrderPrintJob(token: string, shopId: string, orderId: string, jobId: string, printerId?: string) {
  return request<CloudPrintJob>(`/api/v1/shops/${shopId}/orders/${orderId}/jobs/${jobId}/retry`, {
    method: "POST",
    token,
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), printerId }),
  })
}

export async function getDocumentDownloadUrl(token: string, shopId: string, orderId: string, docId: string) {
  return request<{ url: string; sha256Hash: string; mimeType?: string; pageCount: number; expiresIn: number }>(
    `/api/v1/shops/${shopId}/orders/${orderId}/documents/${docId}/download-url`,
    { token }
  )
}

export function recordDocumentAccess(
  token: string,
  shopId: string,
  orderId: string,
  docId: string,
  accessType: "DOWNLOADED" | "PREVIEWED" | "SPOOLED_TO_PRINTER" | "SHREDDED"
) {
  return request<{ logId: string }>(`/api/v1/shops/${shopId}/orders/${orderId}/documents/${docId}/access`, {
    method: "POST",
    token,
    body: JSON.stringify({ accessType }),
  })
}

export function markDocumentShredded(token: string, shopId: string, orderId: string, docId: string) {
  return request<{ docId: string }>(`/api/v1/shops/${shopId}/orders/${orderId}/documents/${docId}/shred`, {
    method: "POST",
    token,
    body: "{}",
  })
}

export function parseOrderStreamMessage(message: string): OrderStreamEvent | null {
  const event = /^event:\s*(.+)$/m.exec(message)?.[1]
  const json = /^data:\s*(.+)$/m.exec(message)?.[1]
  if (!event || !json || event === "ping") {
    return null
  }

  try {
    const data = JSON.parse(json) as unknown
    if (event === "ORDERS_SNAPSHOT") {
      return { type: event, orders: (data as { orders: ShopOrder[] }).orders }
    }
    if (event === "ORDER_CREATED" || event === "ORDER_STATUS_CHANGED") {
      return { type: event, order: data as ShopOrder }
    }
    if (event === "PRINT_JOB_CHANGED") {
      return { type: event, job: data as CloudPrintJob }
    }
  } catch {
    return null
  }

  return null
}

export function streamShopOrders(
  token: string,
  shopId: string,
  onEvent: (event: OrderStreamEvent) => void,
  signal: AbortSignal
) {
  return (async () => {
    let attempt = 0
    while (!signal.aborted) {
      try {
        onEvent({ type: "connection", state: attempt === 0 ? "connected" : "reconnecting" })
        const response = await fetch(`${serverBaseUrl}/api/v1/shops/${shopId}/orders/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          signal,
        })
        if (!response.ok || !response.body) {
          throw new Error(`Order stream failed (${response.status})`)
        }

        attempt = 0
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        while (!signal.aborted) {
          const next = await reader.read()
          if (next.done) {
            break
          }
          buffer += decoder.decode(next.value, { stream: true })
          const messages = buffer.split("\n\n")
          buffer = messages.pop() ?? ""
          for (const message of messages) {
            const event = parseOrderStreamMessage(message)
            if (event) {
              onEvent(event)
            }
          }
        }
      } catch (error) {
        if (signal.aborted) {
          return
        }
        onEvent({
          type: "connection",
          state: "offline",
          message: error instanceof Error ? error.message : "Order stream disconnected",
        })
      }

      attempt += 1
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(10_000, 500 * 2 ** attempt)))
    }
  })()
}
