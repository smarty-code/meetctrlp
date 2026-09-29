import { describe, expect, it } from "vitest"

import { dashboardMetrics, documentReadiness, filterOrders, mergeQueue } from "./dashboard"
import type { CloudPrintJob, PrintJob, Printer, ShopOrder } from "./protocol"

const order = {
  id: "order-1",
  orderNumber: "ORD-1042",
  shopId: "shop-1",
  status: "READY",
  customerPhone: "9876543210",
  pickupCode: "1042",
  amounts: { subtotalMinorUnits: 500, taxMinorUnits: 0, totalMinorUnits: 500 },
  payment: { method: "CASH", status: "PENDING" },
  documents: [
    {
      id: "doc-1",
      originalFilename: "notes.pdf",
      pageCount: 4,
      copies: 1,
      colorMode: "COLOR",
      paperSize: "A4",
    },
  ],
  rejection: { reason: null, category: null },
  lifecycle: { submittedAt: null, acceptedAt: null, readyAt: "2026-09-29T08:00:00.000Z", completedAt: null },
  createdAt: "2026-09-29T07:00:00.000Z",
  updatedAt: "2026-09-29T08:00:00.000Z",
} satisfies ShopOrder

const printer = {
  id: "Office",
  name: "Office",
  isDefault: true,
  status: "ONLINE",
  jobCount: 0,
  isShared: false,
  cloudId: "cloud-1",
  enabled: true,
  offered: { bw: true, color: true, a4: true, a3: false },
} satisfies Printer

describe("dashboard and order filters", () => {
  it("counts cash pending and printer attention from live state", () => {
    const metrics = dashboardMetrics(
      [order],
      [{ ...printer, status: "OFFLINE" }],
      [{ id: "job-1", state: "failed", copies: 1, createdAt: 1, documentName: "notes.pdf", error: "paused" }],
      Date.parse("2026-09-29T12:00:00.000Z"),
    )
    expect(metrics.readyCount).toBe(1)
    expect(metrics.cashPendingPaise).toBe(500)
    expect(metrics.problemPrinterCount).toBe(1)
    expect(metrics.failedJobCount).toBe(1)
  })

  it("filters orders by date and payment method", () => {
    expect(filterOrders([order], { date: "2026-09-29", payment: "CASH" })).toHaveLength(1)
    expect(filterOrders([order], { date: "2026-09-28" })).toHaveLength(0)
    expect(filterOrders([order], { payment: "ONLINE" })).toHaveLength(0)
    expect(filterOrders([order], { payment: "PENDING" })).toHaveLength(1)
  })

  it("reports document readiness against shop-offered printers", () => {
    expect(documentReadiness([printer], { colorMode: "COLOR", paperSize: "A4" }).ready).toBe(true)
    expect(documentReadiness([printer], { colorMode: "COLOR", paperSize: "A3" }).ready).toBe(false)
  })

  it("joins local and cloud jobs into one queue", () => {
    const local: PrintJob = {
      id: "local-1",
      state: "printing",
      copies: 1,
      createdAt: 2,
      cloudJobId: "cloud-job",
      documentName: "notes.pdf",
    }
    const cloud: CloudPrintJob = {
      id: "cloud-job",
      orderId: "order-1",
      documentId: "doc-1",
      printerId: "cloud-1",
      printerName: "Office",
      agentId: "agent-1",
      status: "PRINTING",
      pagesTotal: 4,
      pagesPrinted: 1,
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
    }
    const merged = mergeQueue([local], [cloud, { ...cloud, id: "other", status: "FAILED" }])
    expect(merged).toHaveLength(2)
    expect(merged[0]?.cloud?.id === "cloud-job" || merged[1]?.cloud?.id === "cloud-job").toBe(true)
  })
})
