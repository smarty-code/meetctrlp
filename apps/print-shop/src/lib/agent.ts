import { shopError, shopLog, shopWarn } from "./debug"
import type { AgentStatus, HostIdentity, PrintJob, Printer } from "./protocol"

const SECRET_COMMANDS = new Set([
  "get_refresh_token",
  "set_refresh_token",
  "clear_refresh_token",
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
  shopLog("ipc", "begin", command, SECRET_COMMANDS.has(command) ? "{redacted}" : (args ?? {}))
  try {
    const result = await invoke<T>(command, args)
    shopLog(
      "ipc",
      "ok",
      command,
      `${Math.round(performance.now() - started)}ms`,
      SECRET_COMMANDS.has(command) ? "{redacted}" : result
    )
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
  shopLog("printers", "list", result.printers.length, result.printers)
  return result.printers
}

export function getPrinter(id: string) {
  return call<Printer>("get_printer", { id })
}

export async function refreshPrinters() {
  const result = await call<{ printers: Printer[] }>("refresh_printers")
  shopLog("printers", "refresh", result.printers.length, result.printers)
  return result.printers
}

export function enqueueJob(input: {
  printerId?: string
  documentName?: string
  copies?: number
}) {
  return call<PrintJob>("enqueue_job", {
    printerId: input.printerId,
    documentName: input.documentName,
    copies: input.copies ?? 1,
  })
}

export async function listJobs() {
  const result = await call<{ jobs: PrintJob[] }>("list_jobs")
  shopLog("jobs", "list", result.jobs.length)
  return result.jobs
}

export function cancelJob(id: string) {
  return call<PrintJob>("cancel_job", { id })
}

export async function getStoredRefreshToken() {
  const result = await call<{ refreshToken: string | null }>("get_refresh_token")
  return result.refreshToken
}

export function storeRefreshToken(refreshToken: string) {
  return call<{ ok: boolean }>("set_refresh_token", { refreshToken })
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
