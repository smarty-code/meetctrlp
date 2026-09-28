import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

import type { AgentStatus, PrintJob, Printer } from "./protocol"

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

async function call<T>(command: string, args?: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    throw new Error("Open this UI with pnpm desktop:dev so it can talk to the Windows agent.")
  }

  return invoke<T>(command, args)
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
  return result.jobs
}

export function cancelJob(id: string) {
  return call<PrintJob>("cancel_job", { id })
}

export function listenAgentEvents(onEvent: (payload: unknown) => void) {
  if (!isTauriRuntime()) {
    return Promise.resolve((): UnlistenFn => () => undefined)
  }

  return listen("agent:event", (event) => onEvent(event.payload))
}
