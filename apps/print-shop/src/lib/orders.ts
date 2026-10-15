import type { CloudPrintJob, OrderBoardEvent, ShopNotification, ShopOrder } from "./protocol"
import { pushNotification } from "./dashboard"

export type OrderStore = {
  /** The board: active orders, plus anything that changed since it loaded. */
  orders: ShopOrder[]
  jobsByOrderId: Record<string, CloudPrintJob[]>
  notifications: ShopNotification[]
}

export const emptyOrderStore: OrderStore = {
  orders: [],
  jobsByOrderId: {},
  notifications: [],
}

function newest(orders: ShopOrder[]) {
  return [...orders].sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))
}

/** True when `next` is at least as recent as `current` (deltas overlap by 5 s, so repeats are normal). */
function isNewer(current: { updatedAt: string | null } | undefined, next: { updatedAt: string | null }) {
  if (!current?.updatedAt || !next.updatedAt) {
    return true
  }
  return next.updatedAt >= current.updatedAt
}

function upsertOrders(orders: ShopOrder[], changes: ShopOrder[]) {
  const byId = new Map(orders.map((order) => [order.id, order]))
  for (const order of changes) {
    if (isNewer(byId.get(order.id), order)) {
      byId.set(order.id, order)
    }
  }
  return newest([...byId.values()])
}

function upsertJobs(jobsByOrderId: OrderStore["jobsByOrderId"], changes: CloudPrintJob[]) {
  const next = { ...jobsByOrderId }
  for (const job of changes) {
    const jobs = next[job.orderId] ?? []
    const index = jobs.findIndex((entry) => entry.id === job.id)
    if (index === -1) {
      next[job.orderId] = [...jobs, job]
    } else if (isNewer(jobs[index], job)) {
      next[job.orderId] = jobs.map((entry) => (entry.id === job.id ? job : entry))
    }
  }
  return next
}

function groupJobs(jobs: CloudPrintJob[]) {
  return upsertJobs({}, jobs)
}

function failedJobNotices(store: OrderStore, jobs: CloudPrintJob[]) {
  let notifications = store.notifications
  for (const job of jobs) {
    const before = store.jobsByOrderId[job.orderId]?.find((entry) => entry.id === job.id)
    if (job.status === "FAILED" && before?.status !== "FAILED") {
      notifications = pushNotification(notifications, {
        kind: "print-failed",
        title: "Print failed",
        detail: job.errorMessage ?? `${job.printerName} could not finish the job.`,
      })
    }
  }
  return notifications
}

export function reduceOrderEvent(store: OrderStore, event: OrderBoardEvent): OrderStore {
  if (event.type === "BOARD_SNAPSHOT") {
    return { ...store, orders: newest(event.orders), jobsByOrderId: groupJobs(event.jobs) }
  }

  if (event.type === "BOARD_DELTA") {
    const known = new Set(store.orders.map((order) => order.id))
    let notifications = failedJobNotices(store, event.jobs)
    for (const order of event.orders) {
      if (!known.has(order.id) && order.status === "SUBMITTED") {
        notifications = pushNotification(notifications, {
          kind: "new-order",
          title: "New order",
          detail: `${order.orderNumber} is waiting for acceptance.`,
        })
      }
    }
    return {
      orders: upsertOrders(store.orders, event.orders),
      jobsByOrderId: upsertJobs(store.jobsByOrderId, event.jobs),
      notifications,
    }
  }

  if (event.type === "ORDER_STATUS_CHANGED") {
    return { ...store, orders: upsertOrders(store.orders, [event.order]) }
  }

  return {
    ...store,
    jobsByOrderId: upsertJobs(store.jobsByOrderId, [event.job]),
    notifications: failedJobNotices(store, [event.job]),
  }
}

export function notifyPrinterOffline(store: OrderStore, printerName: string): OrderStore {
  return {
    ...store,
    notifications: pushNotification(store.notifications, {
      kind: "printer-offline",
      title: "Printer offline",
      detail: `${printerName} needs attention.`,
    }),
  }
}
