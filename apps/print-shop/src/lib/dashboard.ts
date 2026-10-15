import { formatTime12h, minutesToTime, timeToMinutes } from "@ctrlp/schemas"

import type { CloudPrintJob, PrintJob, Printer, ShopBusinessHour, ShopNotification, ShopOrder } from "./protocol"

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
}

export function mergeQueue(localJobs: PrintJob[], cloudJobs: CloudPrintJob[]): QueueEntry[] {
  const used = new Set<string>()
  const entries: QueueEntry[] = []
  for (const local of localJobs) {
    const cloud = local.cloudJobId ? cloudJobs.find((job) => job.id === local.cloudJobId) : undefined
    if (cloud) used.add(cloud.id)
    entries.push({
      key: local.id,
      local,
      cloud,
      documentName: local.documentName ?? cloud?.documentId ?? "Queued document",
      printerName: cloud?.printerName ?? local.printerId ?? "Unassigned printer",
      state: cloud?.status?.toLowerCase() ?? local.state,
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
