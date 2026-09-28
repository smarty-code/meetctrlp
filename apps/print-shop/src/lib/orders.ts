import type { CloudPrintJob, OrderStreamEvent, ShopOrder } from "./protocol"

export type OrderStore = {
  orders: ShopOrder[]
  jobsByOrderId: Record<string, CloudPrintJob[]>
  streamState: "connected" | "reconnecting" | "offline"
  streamMessage: string | null
}

export const emptyOrderStore: OrderStore = {
  orders: [],
  jobsByOrderId: {},
  streamState: "offline",
  streamMessage: null,
}

function newest(orders: ShopOrder[]) {
  return [...orders].sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))
}

function upsertOrder(orders: ShopOrder[], next: ShopOrder) {
  const index = orders.findIndex((order) => order.id === next.id)
  if (index === -1) {
    return newest([...orders, next])
  }
  const result = [...orders]
  result[index] = next
  return newest(result)
}

export function reduceOrderEvent(store: OrderStore, event: OrderStreamEvent): OrderStore {
  if (event.type === "connection") {
    return {
      ...store,
      streamState: event.state,
      streamMessage: event.message ?? null,
    }
  }
  if (event.type === "ORDERS_SNAPSHOT") {
    return { ...store, orders: newest(event.orders), streamState: "connected", streamMessage: null }
  }
  if (event.type === "ORDER_CREATED") {
    return { ...store, orders: upsertOrder(store.orders, event.order) }
  }
  if (event.type === "ORDER_STATUS_CHANGED") {
    return { ...store, orders: upsertOrder(store.orders, event.order) }
  }
  if (event.type !== "PRINT_JOB_CHANGED") {
    return store
  }

  const jobs = store.jobsByOrderId[event.job.orderId] ?? []
  const index = jobs.findIndex((job) => job.id === event.job.id)
  const updated = index === -1 ? [...jobs, event.job] : jobs.map((job) => (job.id === event.job.id ? event.job : job))
  return {
    ...store,
    jobsByOrderId: { ...store.jobsByOrderId, [event.job.orderId]: updated },
  }
}
