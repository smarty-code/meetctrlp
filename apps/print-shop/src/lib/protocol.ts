export const protocolVersion = "1.0.0"
export const appVersion = "0.1.0"

export const rpcMethods = {
  hello: "agent.hello",
  ping: "agent.ping",
  status: "agent.status",
  shutdown: "agent.shutdown",
  printersList: "printers.list",
  printersGet: "printers.get",
  printersRefresh: "printers.refresh",
  jobsEnqueue: "jobs.enqueue",
  jobsList: "jobs.list",
  jobsGet: "jobs.get",
  jobsCancel: "jobs.cancel",
  secretsGetRefreshToken: "secrets.getRefreshToken",
  secretsSetRefreshToken: "secrets.setRefreshToken",
  secretsClearRefreshToken: "secrets.clearRefreshToken",
  hostIdentity: "host.identity",
  hostTelemetry: "host.telemetry",
} as const

export type Printer = {
  id: string
  name: string
  isDefault: boolean
  status: string
  jobCount: number
  portName?: string | null
  driverName?: string | null
  isShared: boolean
}

export type PrintJob = {
  id: string
  state: string
  printerId?: string | null
  documentName?: string | null
  copies: number
  createdAt: number
  error?: string | null
}

export type AgentStatus = {
  protocolVersion?: string
  agentVersion?: string
  state: string
  pipeName?: string
  uptimeMs?: number
  printerCount?: number
  queuedJobs?: number
  error?: string
}

export type ShopUserRole = "OWNER" | "MANAGER" | "STAFF"
export type ShopUserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED"

export type ShopUser = {
  id: string
  shopId: string
  name: string
  email: string | null
  phone: string | null
  role: ShopUserRole
  status: ShopUserStatus
  lastLoginAt: string | null
}

export type AuthTokens = {
  idToken: string
  refreshToken: string
  expiresIn: number
}

export type AuthSession = {
  user: ShopUser
  tokens: AuthTokens
}

export type ShopProfile = {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: string
  address: string | null
}

export type ShopStaffMember = {
  id: string
  name: string
  role: ShopUserRole
  status: ShopUserStatus
  lastLoginAt: string | null
}

export type HostIdentity = {
  deviceIdentifier: string
  hostname: string
  osVersion: string
  appVersion: string
  agentVersion: string
}

export type CloudLinkState = "connected" | "reconnecting" | "offline"

export type JsonRpcRequest = {
  jsonrpc: "2.0"
  id: string
  method: string
  params: unknown
}

export function createRpcRequest(
  method: string,
  params: unknown,
  id = crypto.randomUUID()
): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  }
}

export function looksLikeEmail(value: string) {
  return value.includes("@")
}
