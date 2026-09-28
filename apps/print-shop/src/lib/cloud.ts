import { shopError, shopLog } from "./debug"
import { looksLikeEmail, type AuthSession, type ShopProfile, type ShopStaffMember, type ShopUser } from "./protocol"

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
  return request<{ shop: ShopProfile }>("/api/v1/shops/profile", { token })
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
