import { describe, expect, it } from "vitest"

import { emptyOrderStore, reduceOrderEvent } from "./orders"
import type { CloudPrintJob, ShopOrder } from "./protocol"

const order = {
  id: "order-1",
  orderNumber: "ORD-1042",
  shopId: "shop-1",
  status: "SUBMITTED",
  customerPhone: null,
  pickupCode: "1042",
  amounts: { subtotalMinorUnits: 100, taxMinorUnits: 0, totalMinorUnits: 100 },
  payment: { method: "CASH", status: "PENDING" },
  documents: [],
  rejection: { reason: null, category: null },
  lifecycle: { submittedAt: null, acceptedAt: null, readyAt: null, completedAt: null },
  createdAt: "2026-09-28T12:00:00.000Z",
  updatedAt: "2026-09-28T12:00:00.000Z",
} satisfies ShopOrder

const job = {
  id: "job-1",
  orderId: order.id,
  status: "QUEUED",
  printerId: "printer-1",
  printerName: "Office printer",
  documentId: "document-1",
  agentId: "agent-1",
  pagesTotal: 3,
  pagesPrinted: 0,
  spoolerJobId: null,
  retryCount: 0,
  requestedOverrides: {},
  resolvedSettings: {},
  errorCode: null,
  errorMessage: null,
  createdAt: null,
  updatedAt: "2026-09-28T12:00:00.000Z",
  startedAt: null,
  completedAt: null,
} satisfies CloudPrintJob

describe("order board", () => {
  it("replaces everything on a snapshot", () => {
    const stale = reduceOrderEvent(emptyOrderStore, { type: "BOARD_SNAPSHOT", orders: [{ ...order, id: "old" }], jobs: [] })
    const fresh = reduceOrderEvent(stale, { type: "BOARD_SNAPSHOT", orders: [order], jobs: [job] })

    expect(fresh.orders.map((entry) => entry.id)).toEqual(["order-1"])
    expect(fresh.jobsByOrderId[order.id]).toEqual([job])
  })

  it("merges a delta without losing other orders, and announces new orders", () => {
    const base = reduceOrderEvent(emptyOrderStore, { type: "BOARD_SNAPSHOT", orders: [{ ...order, id: "other" }], jobs: [] })
    const merged = reduceOrderEvent(base, { type: "BOARD_DELTA", orders: [order], jobs: [job] })

    expect(merged.orders.map((entry) => entry.id).sort()).toEqual(["order-1", "other"])
    expect(merged.jobsByOrderId[order.id]).toHaveLength(1)
    expect(merged.notifications[0]?.kind).toBe("new-order")
  })

  it("keeps the newer copy when deltas overlap", () => {
    const later = { ...order, status: "SHOP_ACCEPTED" as const, updatedAt: "2026-09-28T12:05:00.000Z" }
    const store = reduceOrderEvent(emptyOrderStore, { type: "BOARD_SNAPSHOT", orders: [later], jobs: [] })
    // The 5 s overlap re-sends an older version of the same order.
    const replayed = reduceOrderEvent(store, { type: "BOARD_DELTA", orders: [order], jobs: [] })

    expect(replayed.orders[0]?.status).toBe("SHOP_ACCEPTED")
    expect(replayed.notifications).toHaveLength(0)
  })

  it("moves an order that left the active set by its new status", () => {
    const store = reduceOrderEvent(emptyOrderStore, { type: "BOARD_SNAPSHOT", orders: [order], jobs: [] })
    const done = reduceOrderEvent(store, {
      type: "BOARD_DELTA",
      orders: [{ ...order, status: "COMPLETED", updatedAt: "2026-09-28T13:00:00.000Z" }],
      jobs: [],
    })

    expect(done.orders[0]?.status).toBe("COMPLETED")
  })

  it("notifies once when a job fails", () => {
    const store = reduceOrderEvent(emptyOrderStore, { type: "BOARD_SNAPSHOT", orders: [order], jobs: [job] })
    const failedJob = { ...job, status: "FAILED" as const, errorMessage: "Paper jam", updatedAt: "2026-09-28T12:10:00.000Z" }
    const failed = reduceOrderEvent(store, { type: "BOARD_DELTA", orders: [], jobs: [failedJob] })
    const again = reduceOrderEvent(failed, { type: "BOARD_DELTA", orders: [], jobs: [failedJob] })

    expect(failed.notifications.map((entry) => entry.kind)).toEqual(["print-failed"])
    expect(again.notifications).toHaveLength(1)
  })

  it("applies the operator's own changes from action responses", () => {
    const store = reduceOrderEvent(emptyOrderStore, { type: "BOARD_SNAPSHOT", orders: [order], jobs: [] })
    const accepted = reduceOrderEvent(store, {
      type: "ORDER_STATUS_CHANGED",
      order: { ...order, status: "SHOP_ACCEPTED", updatedAt: "2026-09-28T12:01:00.000Z" },
    })

    expect(accepted.orders[0]?.status).toBe("SHOP_ACCEPTED")
  })
})
