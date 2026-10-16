import { formatTime12h, minutesToTime, timeToMinutes } from "@ctrlp/schemas"

import type {
  CloudPrintJob,
  PrintJob,
  Printer,
  ShopBusinessHour,
  ShopNotification,
  ShopOrder,
  ShopOrderQueueError,
} from "./protocol"

const DAY_MS = 24 * 60 * 60 * 1000

export function startOfLocalDay(now = Date.now()) {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export function rupees(paise: number) {
  return `₹${(paise / 100).toFixed(2)}`
}

export function dashboardMetrics(
  orders: ShopOrder[],
  printers: Printer[],
  jobs: PrintJob[],
  now = Date.now(),
) {
  const today = startOfLocalDay(now)
  const isToday = (value: string | null | undefined) => {
    if (!value) return false
    const time = Date.parse(value)
    return Number.isFinite(time) && time >= today && time < today + DAY_MS
  }

  const newCount = orders.filter((order) => order.status === "SUBMITTED").length
  const active = orders.filter((order) => order.status === "SHOP_ACCEPTED" || order.status === "PRINTING")
  const printing = orders.filter((order) => order.status === "PRINTING").length
  const ready = orders.filter((order) => order.status === "READY")
  const completedToday = orders.filter((order) => order.status === "COMPLETED" && isToday(order.lifecycle.completedAt ?? order.updatedAt))
  const paidOnlineToday = orders.filter(
    (order) =>
      order.payment.method === "ONLINE" &&
      order.payment.status === "PAID" &&
      isToday(order.lifecycle.completedAt ?? order.updatedAt ?? order.createdAt),
  )
  const cashPending = ready.filter((order) => order.payment.method === "CASH" && order.payment.status === "PENDING")
  const cashInDrawerToday = orders.filter(
    (order) => order.payment.method === "CASH" && order.payment.status === "PAID" && isToday(order.updatedAt),
  )
  const failedJobs = jobs.filter((job) => job.state === "failed")
  const problemPrinters = printers.filter((printer) => {
    const status = printer.status.toUpperCase()
    return status === "OFFLINE" || status === "ERROR" || status === "PAUSED"
  })

  return {
    newCount,
    activeCount: active.length,
    printingCount: printing,
    readyCount: ready.length,
    completedTodayCount: completedToday.length,
    paidOnlineTodayPaise: paidOnlineToday.reduce((sum, order) => sum + order.amounts.totalMinorUnits, 0),
    cashPendingPaise: cashPending.reduce((sum, order) => sum + order.amounts.totalMinorUnits, 0),
    cashInDrawerTodayPaise: cashInDrawerToday.reduce((sum, order) => sum + order.amounts.totalMinorUnits, 0),
    failedJobCount: failedJobs.length,
    problemPrinterCount: problemPrinters.length,
    attention: [
      ...failedJobs.map((job) => `${job.documentName ?? "Print job"} failed${job.error ? `: ${job.error}` : ""}`),
      ...problemPrinters.map((printer) => `${printer.name} is ${printer.status.toLowerCase()}`),
    ],
    recentOrders: [...orders].slice(0, 8),
  }
}

export function pushNotification(list: ShopNotification[], next: Omit<ShopNotification, "id" | "createdAt"> & { id?: string }) {
  const item: ShopNotification = {
    id: next.id ?? crypto.randomUUID(),
    kind: next.kind,
    title: next.title,
    detail: next.detail,
    createdAt: new Date().toISOString(),
  }
  return [item, ...list].slice(0, 20)
}

export function compatiblePrintersForDocument(
  printers: Printer[],
  spec: { colorMode: "BW" | "COLOR"; paperSize: "A4" | "A3" },
) {
  return printers.filter((printer) => {
    if (printer.enabled === false) return false
    const offered = printer.offered
    if (spec.colorMode === "COLOR" && offered && offered.color !== true) return false
    if (spec.paperSize === "A3" && offered && offered.a3 !== true) return false
    return Boolean(printer.cloudId)
  })
}

export function documentReadiness(
  printers: Printer[],
  spec: { colorMode: "BW" | "COLOR"; paperSize: "A4" | "A3" },
) {
  const matches = compatiblePrintersForDocument(printers, spec)
  const reasons: string[] = []
  if (spec.colorMode === "COLOR" && !printers.some((printer) => printer.enabled !== false && printer.offered?.color)) {
    reasons.push("Color is not offered on any enabled printer")
  }
  if (spec.paperSize === "A3" && !printers.some((printer) => printer.enabled !== false && printer.offered?.a3)) {
    reasons.push("A3 is not offered on any enabled printer")
  }
  if (matches.length === 0 && reasons.length === 0) {
    reasons.push("No enabled shop printer is assigned to this PC")
  }
  return { ready: matches.length > 0, matches, reasons }
}

export type QueueEntry = {
  key: string
  local?: PrintJob
  cloud?: CloudPrintJob
  documentName: string
  printerName: string
  state: string
  error?: string | null
  createdAt: number
  pagesPrinted?: number
  pagesTotal?: number
  /** A local row from an earlier lease of a job the shop has since retried, rescued or cancelled. History: no actions. */
  superseded?: boolean
}

export function mergeQueue(localJobs: PrintJob[], cloudJobs: CloudPrintJob[]): QueueEntry[] {
  const used = new Set<string>()
  const entries: QueueEntry[] = []
  for (const local of localJobs) {
    const match = local.cloudJobId ? cloudJobs.find((job) => job.id === local.cloudJobId) : undefined
    // The board has the job's current lease (null once it is retried or cancelled). A local row under another
    // lease is an earlier attempt: it keeps its own state and leaves the job's status and actions to the
    // current attempt, or to the job's own entry.
    const superseded = Boolean(match && local.leaseId && match.leaseId !== undefined && match.leaseId !== local.leaseId)
    const cloud = superseded ? undefined : match
    if (cloud) used.add(cloud.id)
    entries.push({
      key: local.id,
      local,
      cloud,
      superseded,
      documentName: local.documentName ?? match?.documentId ?? "Queued document",
      printerName: match?.printerName ?? local.printerId ?? "Unassigned printer",
      // The server hears from this PC only at the final report, so it says DISPATCHING while the page is
      // on the printer. The local row knows better.
      state: superseded || local.state === "printing" ? local.state : (cloud?.status?.toLowerCase() ?? local.state),
      error: local.error ?? cloud?.errorMessage,
      createdAt: local.createdAt,
      pagesPrinted: local.pagesPrinted ?? cloud?.pagesPrinted,
      pagesTotal: local.pagesTotal ?? cloud?.pagesTotal,
    })
  }
  for (const cloud of cloudJobs) {
    if (used.has(cloud.id)) continue
    entries.push({
      key: `cloud:${cloud.id}`,
      cloud,
      documentName: cloud.documentId,
      printerName: cloud.printerName,
      state: cloud.status.toLowerCase(),
      error: cloud.errorMessage,
      createdAt: cloud.createdAt ? Date.parse(cloud.createdAt) : 0,
      pagesPrinted: cloud.pagesPrinted,
      pagesTotal: cloud.pagesTotal,
    })
  }
  return entries.sort((left, right) => right.createdAt - left.createdAt)
}

const notStarted = (job: PrintJob | undefined) => job?.state === "created" || job?.state === "queued"

export type RetryTarget = { kind: "cloud"; orderId: string; jobId: string } | { kind: "local"; id: string }

/**
 * Where a retry goes. A cloud job is retried by the server, which issues a new lease; the agent refuses to
 * re-queue it under the spent one. Only a job that never came from the cloud (a test page) retries locally.
 */
export function retryTarget(entry: QueueEntry): RetryTarget | null {
  if (entry.superseded) return null
  const jobId = entry.cloud?.id ?? entry.local?.cloudJobId
  if (jobId) {
    const orderId = entry.cloud?.orderId ?? entry.local?.cloudOrderId
    return orderId ? { kind: "cloud", orderId, jobId } : null
  }
  return entry.local ? { kind: "local", id: entry.local.id } : null
}

/** The server cancels a cloud job that is waiting, failed, or stuck with a PC for 15 minutes. */
export function canCancelCloudJob(job: CloudPrintJob | undefined, now = Date.now()) {
  return job?.status === "QUEUED" || job?.status === "FAILED" || isStuckCloudJob(job, now)
}

/** `localId`: this PC holds the job's lease and hasn't started it, so it can also cancel it here. */
export type CancelTarget =
  | { kind: "cloud"; orderId: string; jobId: string; localId?: string }
  | { kind: "local"; id: string }

/**
 * Where a cancel goes, or null when there is nothing to cancel. Printing can't be stopped at the spooler. A
 * cloud job is cancelled by the server; a job that never came from the cloud (a test page) is cancelled here.
 */
export function cancelTarget(entry: QueueEntry, now = Date.now()): CancelTarget | null {
  if (entry.superseded || entry.local?.state === "printing") return null
  const jobId = entry.cloud?.id ?? entry.local?.cloudJobId
  if (!jobId) {
    return entry.local && notStarted(entry.local) ? { kind: "local", id: entry.local.id } : null
  }
  const orderId = entry.cloud?.orderId ?? entry.local?.cloudOrderId
  const heldHere = notStarted(entry.local) && entry.local?.reportState !== "revoked"
  if (!orderId || !(heldHere || canCancelCloudJob(entry.cloud, now))) return null
  return heldHere ? { kind: "cloud", orderId, jobId, localId: entry.local!.id } : { kind: "cloud", orderId, jobId }
}

export type CancelActions = {
  cancelCloud: (orderId: string, jobId: string) => Promise<CloudPrintJob>
  cancelLocal: (id: string) => Promise<unknown>
  /** Asks the agent to sync now, so a PC holding the job hears that its lease was revoked. */
  requestSync: () => void
}

const cancelMessages: Record<string, string> = {
  PRINT_JOB_STILL_ACTIVE: "Another PC is still printing this job. It can be cancelled once it has been stuck there for 15 minutes.",
  PRINT_JOB_STATUS_CONFLICT: "This job has already finished, so there is nothing to cancel.",
  PRINT_JOB_NOT_FOUND: "This job no longer exists.",
}

/**
 * Runs a cancel and returns the server's updated job, if any. The server refuses a job a live PC holds
 * (PRINT_JOB_STILL_ACTIVE); when that PC is this one and it hasn't started, the local cancel stops it and
 * reports CANCELLED under its lease, which the server accepts.
 */
export async function cancelQueueEntry(target: CancelTarget, actions: CancelActions): Promise<CloudPrintJob | null> {
  if (target.kind === "local") {
    await actions.cancelLocal(target.id)
    return null
  }
  let job: CloudPrintJob
  try {
    job = await actions.cancelCloud(target.orderId, target.jobId)
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err)
    if (target.localId && code === "PRINT_JOB_STILL_ACTIVE") {
      await actions.cancelLocal(target.localId)
      return null
    }
    throw new Error(cancelMessages[code] ?? code)
  }
  if (target.localId) {
    // Stop it here at once rather than at the next sync; the sync's revoke then drops its report.
    await actions.cancelLocal(target.localId).catch(() => undefined)
  }
  actions.requestSync()
  return job
}

export type OrderQueueError = ShopOrderQueueError & { documentName: string }

/** Documents of an accepted order the server couldn't queue, by name. A missing field (older server) is none. */
export function orderQueueErrors(order: ShopOrder): OrderQueueError[] {
  return (order.queueErrors ?? []).map((entry) => {
    const document = order.documents.find((candidate) => (candidate.docId ?? candidate.id) === entry.documentId)
    return { ...entry, documentName: document?.originalFilename ?? "A document" }
  })
}

/** The shop-time calendar day (`YYYY-MM-DD`) of an instant. Shops are in India (Asia/Kolkata). */
export function shopDay(iso: string | null | undefined) {
  if (!iso) return ""
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ""
  return at.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

/** A cloud job stuck DISPATCHING this long belongs to a PC that stopped syncing (implementation plan 6.3). */
export const STUCK_JOB_MS = 15 * 60 * 1000

/** True when the operator may rescue this cloud job onto another printer, after confirming. */
export function isStuckCloudJob(job: CloudPrintJob | undefined, now = Date.now()) {
  if (!job || (job.status !== "DISPATCHING" && job.status !== "PRINTING")) return false
  const claimed = job.claimedAt ? Date.parse(job.claimedAt) : Number.NaN
  return Number.isFinite(claimed) && now - claimed >= STUCK_JOB_MS
}

export function filterOrders(
  orders: ShopOrder[],
  input: {
    statuses?: ShopOrder["status"][]
    search?: string
    date?: string
    payment?: "all" | "CASH" | "ONLINE" | "PENDING" | "PAID"
  },
) {
  const query = input.search?.trim().toLowerCase() ?? ""
  return orders.filter((order) => {
    if (input.statuses && !input.statuses.includes(order.status)) return false
    if (input.date && shopDay(order.createdAt) !== input.date) return false
    if (input.payment && input.payment !== "all") {
      if (input.payment === "CASH" || input.payment === "ONLINE") {
        if (order.payment.method !== input.payment) return false
      } else if (order.payment.status !== input.payment) {
        return false
      }
    }
    if (!query) return true
    return [order.orderNumber, order.customerPhone, ...order.documents.map((document) => document.originalFilename)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query)
  })
}

export const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export type EditableBusinessHour = {
  dayOfWeek: number
  opensAt: string
  closesAt: string
  isClosed: boolean
  isOpen24Hours: boolean
}

export function defaultHours(): EditableBusinessHour[] {
  return weekdayLabels.map((_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: "09:00",
    closesAt: "21:00",
    isClosed: true,
    isOpen24Hours: false,
  }))
}

/** One row per weekday from the saved config, filling gaps and older payloads with defaults. */
export function editableHours(saved: ShopBusinessHour[] | undefined): EditableBusinessHour[] {
  if (!saved || saved.length === 0) return defaultHours()
  return defaultHours().map((fallback) => {
    const day = saved.find((entry) => entry.dayOfWeek === fallback.dayOfWeek)
    if (!day) return fallback
    return {
      dayOfWeek: day.dayOfWeek,
      opensAt: day.opensAt,
      closesAt: day.closesAt,
      isClosed: day.isClosed,
      isOpen24Hours: day.isOpen24Hours === true && !day.isClosed,
    }
  })
}

const TIME_STEP_MINUTES = 15

/** 12-hour picker options in 15-minute steps; keeps an off-grid saved time selectable. */
export function timeOptions(current?: string): Array<{ value: string; label: string }> {
  const values = Array.from({ length: (24 * 60) / TIME_STEP_MINUTES }, (_, index) =>
    minutesToTime(index * TIME_STEP_MINUTES),
  )
  if (current && !values.includes(current)) {
    values.push(current)
    values.sort((left, right) => timeToMinutes(left) - timeToMinutes(right))
  }
  return values.map((value) => ({ value, label: formatTime12h(value) }))
}

/** Sets every day to open around the clock, or back to regular open hours. */
export function setOpen24x7(hours: EditableBusinessHour[], enabled: boolean): EditableBusinessHour[] {
  return hours.map((hour) => ({ ...hour, isClosed: false, isOpen24Hours: enabled }))
}

export function paiseToRupeesInput(paise: number) {
  return (Math.max(0, paise) / 100).toFixed(2)
}

export function rupeesInputToPaise(value: string) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * 100)
}
