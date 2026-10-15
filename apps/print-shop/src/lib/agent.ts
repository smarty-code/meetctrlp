import { shopError, shopLog, shopWarn } from "./debug"
import type { AgentStatus, HostIdentity, PrintJob, Printer } from "./protocol"

const SECRET_COMMANDS = new Set([
  "get_refresh_token",
  "set_refresh_token",
  "clear_refresh_token",
  "agent_notify",
  "agent_get_id_token",
])

const QUIET_COMMANDS = new Set([
  "get_agent_status",
  "list_printers",
  "agent_ping",
  "get_host_telemetry",
  "list_jobs",
  "agent_get_id_token",
])

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

async function call<T>(command: string, args?: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    shopWarn("ipc", command, "skipped: not a Tauri runtime")
    throw new Error("Open this UI with pnpm desktop:dev so it can talk to the Windows agent.")
  }

  const { invoke } = await import("@tauri-apps/api/core")
  const started = performance.now()
  if (!QUIET_COMMANDS.has(command)) {
    shopLog("ipc", "begin", command, SECRET_COMMANDS.has(command) ? "{redacted}" : (args ?? {}))
  }
  try {
    const result = await invoke<T>(command, args)
    if (!QUIET_COMMANDS.has(command)) {
      shopLog(
        "ipc",
        "ok",
        command,
        `${Math.round(performance.now() - started)}ms`,
        SECRET_COMMANDS.has(command) ? "{redacted}" : result
      )
    }
    return result
  } catch (error) {
    shopError(
      "ipc",
      "err",
      command,
      `${Math.round(performance.now() - started)}ms`,
      error
    )
    throw error
  }
}

export function pingAgent() {
  return call<{ ok: boolean; ts: number }>("agent_ping")
}

export function getAgentStatus() {
  return call<AgentStatus>("get_agent_status")
}

export async function listPrinters() {
  const result = await call<{ printers: Printer[] }>("list_printers")
  return result.printers
}

export function getPrinter(id: string) {
  return call<Printer>("get_printer", { id })
}

export async function refreshPrinters() {
  const result = await call<{ printers: Printer[] }>("refresh_printers")
  shopLog("printers", "refresh", result.printers.length)
  return result.printers
}

export function printTestPage(printerId?: string) {
  return call<PrintJob>("print_test_page", { printerId })
}

export function exportAgentLog() {
  return call<{ path: string; bytesCopied: number; cancelled?: boolean }>("export_agent_log")
}

export async function listJobs() {
  const result = await call<{ jobs: PrintJob[] }>("list_jobs")
  return result.jobs
}

export function cancelJob(id: string) {
  return call<PrintJob>("cancel_job", { id })
}

export function retryJob(id: string) {
  return call<PrintJob>("retry_job", { id })
}

export async function getStoredRefreshToken() {
  const result = await call<{ refreshToken: string | null }>("get_refresh_token")
  return result.refreshToken
}

export function storeRefreshToken(refreshToken: string) {
  return call<{ ok: boolean }>("set_refresh_token", { refreshToken })
}

/** One-way messages to the agent; it sends no reply (implementation plan 9.2). */
export type AgentNotification =
  | {
      method: "cloud.configure"
      params: { serverBaseUrl: string; firebaseApiKey: string; databaseUrl: string }
    }
  | {
      method: "cloud.session"
      // expiresAt is epoch milliseconds; a login's ID token seeds the agent so it doesn't refresh at once.
      params: { shopId: string; agentId: string; idToken?: string; expiresAt?: number }
    }
  | { method: "cloud.clear"; params?: Record<string, never> }
  | { method: "sync.request"; params?: Record<string, never> }

export function agentNotify(notification: AgentNotification) {
  return call<void>("agent_notify", {
    method: notification.method,
    params: notification.params ?? {},
  })
}

export type AgentIdToken = {
  signedIn: boolean
  idToken?: string
  /** Epoch milliseconds. */
  expiresAt?: number
  claims?: { shopId?: string; shopUserId?: string; role?: string }
}

/** The API bearer token, cached and refreshed by the agent, which owns this PC's login. */
export function getAgentIdToken(forceRefresh = false) {
  return call<AgentIdToken>("agent_get_id_token", { forceRefresh })
}

/** From the agent's `cloud.state` notification. */
export type AgentCloudState = {
  doorbell: "connected" | "connecting" | "polling" | "offline"
  token: "valid" | "refreshing" | "invalid" | "none"
  pendingReports: number
  lastSyncAt?: number
  lastError?: string
}

export function clearStoredRefreshToken() {
  return call<{ ok: boolean }>("clear_refresh_token")
}

export function getHostIdentity() {
  return call<HostIdentity>("get_host_identity")
}

export function getHostTelemetry() {
  return call<{ memoryWorkingSetBytes: number }>("get_host_telemetry")
}

export async function waitForAgent(timeoutMs = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const status = await getAgentStatus()
      if (status.state === "ready" || status.state === "connected") {
        return status
      }
    } catch {
      // Agent still booting.
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250))
  }

  throw new Error("Print agent is still starting.")
}

export async function listenAgentEvents(onEvent: (payload: unknown) => void) {
  if (!isTauriRuntime()) {
    return () => undefined
  }

  const { listen } = await import("@tauri-apps/api/event")
  return listen("agent:event", (event) => onEvent(event.payload))
}

/** Fires once per app start, when the bridge to the agent is up. Answer it with cloud.configure and cloud.session. */
export async function listenAgentReady(onReady: () => void) {
  if (!isTauriRuntime()) {
    return () => undefined
  }

  const { listen } = await import("@tauri-apps/api/event")
  return listen("agent:ready", () => onReady())
}
