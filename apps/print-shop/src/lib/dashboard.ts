import type { CloudPrintJob, PrintJob, Printer, ShopNotification, ShopOrder } from "./protocol"

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
    if (input.date) {
      const created = (order.createdAt ?? "").slice(0, 10)
      if (created !== input.date) return false
    }
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

export function defaultHours(): Array<{ dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }> {
  return weekdayLabels.map((_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: "09:00",
    closesAt: "21:00",
    isClosed: true,
  }))
}

export function paiseToRupeesInput(paise: number) {
  return (Math.max(0, paise) / 100).toFixed(2)
}

export function rupeesInputToPaise(value: string) {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * 100)
}
