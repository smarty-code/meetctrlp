import { describe, expect, it } from "vitest"

import { parseOrderStreamMessage } from "./cloud"
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
  updatedAt: null,
  startedAt: null,
  completedAt: null,
} satisfies CloudPrintJob

describe("order stream state", () => {
  it("parses snapshot and ignores malformed server-sent events", () => {
    expect(parseOrderStreamMessage(`event: ORDERS_SNAPSHOT\ndata: {"orders":[${JSON.stringify(order)}]}`)).toEqual({
      type: "ORDERS_SNAPSHOT",
      orders: [order],
    })
    expect(parseOrderStreamMessage("event: PRINT_JOB_CHANGED\ndata: not-json")).toBeNull()
    expect(parseOrderStreamMessage("event: ping\ndata: {}")).toBeNull()
  })

  it("merges order and print-job deltas without losing existing orders", () => {
    const withOrder = reduceOrderEvent(emptyOrderStore, { type: "ORDER_CREATED", order })
    const withJob = reduceOrderEvent(withOrder, {
      type: "PRINT_JOB_CHANGED",
      job,
    })

    expect(withJob.orders).toEqual([order])
    expect(withJob.jobsByOrderId[order.id]).toHaveLength(1)
    expect(withJob.jobsByOrderId[order.id][0]?.status).toBe("QUEUED")
  })
})
