import { describe, expect, it } from "vitest"

import {
  STUCK_JOB_MS,
  cancelQueueEntry,
  cancelTarget,
  dashboardMetrics,
  documentReadiness,
  filterOrders,
  isStuckCloudJob,
  mergeQueue,
  orderQueueErrors,
  retryTarget,
  shopDay,
} from "./dashboard"
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

describe("print queue entries", () => {
  const cloud: CloudPrintJob = {
    id: "cloud-job",
    orderId: "order-1",
    documentId: "doc-1",
    printerId: "cloud-1",
    printerName: "Office",
    agentId: "agent-1",
    status: "DISPATCHING",
    pagesTotal: 4,
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
  }
  const local = (state: string, extra: Partial<PrintJob> = {}): PrintJob => ({
    id: `local-${state}`,
    state,
    copies: 1,
    createdAt: 1,
    cloudJobId: "cloud-job",
    cloudOrderId: "order-1",
    ...extra,
  })

  it("shows printing while this PC prints a job the server still calls dispatching", () => {
    expect(mergeQueue([local("printing")], [cloud])[0]?.state).toBe("printing")
  })

  it("keeps the server status when the local row isn't printing", () => {
    expect(mergeQueue([local("queued")], [cloud])[0]?.state).toBe("dispatching")
    expect(mergeQueue([local("failed")], [{ ...cloud, status: "FAILED" }])[0]?.state).toBe("failed")
    expect(mergeQueue([local("completed", { cloudJobId: null, cloudOrderId: null })], [])[0]?.state).toBe("completed")
  })

  it("treats a local row from an earlier lease as history and lists the job on its own", () => {
    // The shop retried the job: the board's lease is new (or null), the local row has the old one.
    const merged = mergeQueue([local("failed", { leaseId: "lease-1" })], [{ ...cloud, status: "QUEUED", leaseId: null }])
    const old = merged.find((entry) => entry.local)!
    const current = merged.find((entry) => !entry.local)!
    expect(old.superseded).toBe(true)
    expect(old.state).toBe("failed")
    expect(retryTarget(old)).toBeNull()
    expect(cancelTarget(old)).toBeNull()
    expect(current.state).toBe("queued")
    // Same lease, or a board that doesn't send leases: one entry, as before.
    expect(mergeQueue([local("queued", { leaseId: "lease-1" })], [{ ...cloud, leaseId: "lease-1" }])).toHaveLength(1)
    expect(mergeQueue([local("queued", { leaseId: "lease-1" })], [cloud])).toHaveLength(1)
  })

  it("offers cancel on waiting, failed and stuck jobs, never while printing", () => {
    const now = Date.parse("2026-10-16T10:00:00.000Z")
    const stuck = { ...cloud, claimedAt: new Date(now - STUCK_JOB_MS).toISOString() }
    const fresh = { ...cloud, claimedAt: new Date(now - 60_000).toISOString() }
    const target = (locals: PrintJob[], jobs: CloudPrintJob[]) => cancelTarget(mergeQueue(locals, jobs)[0]!, now)

    expect(target([], [{ ...cloud, status: "QUEUED" }])).toEqual({ kind: "cloud", orderId: "order-1", jobId: "cloud-job" })
    expect(target([], [{ ...cloud, status: "FAILED" }])).toEqual({ kind: "cloud", orderId: "order-1", jobId: "cloud-job" })
    expect(target([], [stuck])).toEqual({ kind: "cloud", orderId: "order-1", jobId: "cloud-job" })
    expect(target([], [fresh])).toBeNull()
    expect(target([], [{ ...cloud, status: "COMPLETED" }])).toBeNull()
    // Waiting on this PC, which holds the lease: the server first, then this PC if the server says it's active.
    expect(target([local("queued")], [fresh])).toEqual({ kind: "cloud", orderId: "order-1", jobId: "cloud-job", localId: "local-queued" })
    expect(target([local("queued")], [])).toEqual({ kind: "cloud", orderId: "order-1", jobId: "cloud-job", localId: "local-queued" })
    expect(target([local("printing")], [stuck])).toBeNull()
    expect(target([local("queued", { reportState: "revoked", state: "cancelled" })], [fresh])).toBeNull()
    // A test page never came from the cloud.
    expect(target([local("queued", { cloudJobId: null, cloudOrderId: null })], [])).toEqual({ kind: "local", id: "local-queued" })
    expect(target([local("failed", { cloudJobId: null, cloudOrderId: null })], [])).toBeNull()
  })

  it("cancels a cloud job on the server and asks the agent to sync", async () => {
    const calls: string[] = []
    const cancelled = { ...cloud, status: "CANCELLED" as const, leaseId: null }
    const result = await cancelQueueEntry(
      { kind: "cloud", orderId: "order-1", jobId: "cloud-job" },
      {
        cancelCloud: async (orderId, jobId) => (calls.push(`server ${orderId}/${jobId}`), cancelled),
        cancelLocal: async (id) => calls.push(`local ${id}`),
        requestSync: () => calls.push("sync"),
      },
    )
    expect(result).toBe(cancelled)
    expect(calls).toEqual(["server order-1/cloud-job", "sync"])
  })

  it("also stops a copy waiting on this PC right away", async () => {
    const calls: string[] = []
    await cancelQueueEntry(
      { kind: "cloud", orderId: "order-1", jobId: "cloud-job", localId: "local-queued" },
      {
        cancelCloud: async () => (calls.push("server"), { ...cloud, status: "CANCELLED" as const }),
        cancelLocal: async (id) => calls.push(`local ${id}`),
        requestSync: () => calls.push("sync"),
      },
    )
    expect(calls).toEqual(["server", "local local-queued", "sync"])
  })

  it("cancels here when the server says this PC still holds the job", async () => {
    const calls: string[] = []
    const result = await cancelQueueEntry(
      { kind: "cloud", orderId: "order-1", jobId: "cloud-job", localId: "local-queued" },
      {
        cancelCloud: async () => {
          throw new Error("PRINT_JOB_STILL_ACTIVE")
        },
        cancelLocal: async (id) => calls.push(`local ${id}`),
        requestSync: () => calls.push("sync"),
      },
    )
    expect(result).toBeNull()
    expect(calls).toEqual(["local local-queued"])
  })

  it("explains a refused cancel and changes nothing locally", async () => {
    const calls: string[] = []
    const actions = (code: string) => ({
      cancelCloud: async (): Promise<CloudPrintJob> => {
        throw new Error(code)
      },
      cancelLocal: async (id: string) => calls.push(`local ${id}`),
      requestSync: () => calls.push("sync"),
    })
    const target = { kind: "cloud" as const, orderId: "order-1", jobId: "cloud-job" }
    await expect(cancelQueueEntry(target, actions("PRINT_JOB_STILL_ACTIVE"))).rejects.toThrow("Another PC is still printing this job")
    await expect(cancelQueueEntry(target, actions("PRINT_JOB_STATUS_CONFLICT"))).rejects.toThrow("already finished")
    await expect(cancelQueueEntry(target, actions("PRINT_JOB_NOT_FOUND"))).rejects.toThrow("no longer exists")
    await expect(cancelQueueEntry(target, actions("Request failed (500)"))).rejects.toThrow("Request failed (500)")
    expect(calls).toEqual([])
  })

  it("cancels a test page on this PC only", async () => {
    const calls: string[] = []
    await cancelQueueEntry(
      { kind: "local", id: "local-queued" },
      {
        cancelCloud: async () => (calls.push("server"), cloud),
        cancelLocal: async (id) => calls.push(`local ${id}`),
        requestSync: () => calls.push("sync"),
      },
    )
    expect(calls).toEqual(["local local-queued"])
  })

  it("sends a cloud job's retry to the server even before the board has the job", () => {
    const [withBoard] = mergeQueue([local("failed")], [{ ...cloud, status: "FAILED" }])
    const [withoutBoard] = mergeQueue([local("failed")], [])
    const [testPage] = mergeQueue([local("failed", { cloudJobId: null, cloudOrderId: null })], [])
    const [noOrder] = mergeQueue([local("failed", { cloudOrderId: null })], [])
    expect(retryTarget(withBoard!)).toEqual({ kind: "cloud", orderId: "order-1", jobId: "cloud-job" })
    expect(retryTarget(withoutBoard!)).toEqual({ kind: "cloud", orderId: "order-1", jobId: "cloud-job" })
    expect(retryTarget(testPage!)).toEqual({ kind: "local", id: "local-failed" })
    expect(retryTarget(noOrder!)).toBeNull()
  })
})

describe("order queue errors", () => {
  it("names each document the server couldn't queue, with its message", () => {
    const withErrors: ShopOrder = {
      ...order,
      status: "SHOP_ACCEPTED",
      documents: [...order.documents, { ...order.documents[0]!, id: "doc-2", docId: "doc-2", originalFilename: "slides.pdf" }],
      queueErrors: [
        { documentId: "doc-2", code: "QUEUE_FAILED", message: "no compatible online printer is available", at: "2026-10-16T10:00:00.000Z" },
        { documentId: "doc-gone", code: "DOCUMENT_MISSING", message: "the document was removed", at: "2026-10-16T10:00:00.000Z" },
      ],
    }

    expect(orderQueueErrors(withErrors)).toEqual([
      expect.objectContaining({ documentId: "doc-2", documentName: "slides.pdf", message: "no compatible online printer is available" }),
      expect.objectContaining({ documentId: "doc-gone", documentName: "A document", code: "DOCUMENT_MISSING" }),
    ])
  })

  it("treats a missing or cleared list as no errors", () => {
    expect(orderQueueErrors(order)).toEqual([])
    expect(orderQueueErrors({ ...order, queueErrors: [] })).toEqual([])
  })
})

describe("shop time and stuck jobs", () => {
  it("uses the India calendar day, not the UTC one", () => {
    // 00:15 India time on 15 Oct is 18:45 UTC on 14 Oct.
    expect(shopDay("2026-10-14T18:45:00.000Z")).toBe("2026-10-15")
    expect(shopDay(null)).toBe("")
  })

  it("lets the operator rescue a job dispatching for 15 minutes", () => {
    const now = Date.parse("2026-10-15T10:00:00.000Z")
    const job = { status: "DISPATCHING", claimedAt: new Date(now - STUCK_JOB_MS).toISOString() } as never
    expect(isStuckCloudJob(job, now)).toBe(true)
    expect(isStuckCloudJob({ status: "DISPATCHING", claimedAt: new Date(now - 60_000).toISOString() } as never, now)).toBe(false)
    expect(isStuckCloudJob({ status: "FAILED", claimedAt: null } as never, now)).toBe(false)
    expect(isStuckCloudJob(undefined, now)).toBe(false)
  })
})
