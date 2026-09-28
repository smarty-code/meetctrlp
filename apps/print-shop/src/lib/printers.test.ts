import { describe, expect, it } from "vitest"

import {
  assertOfferWithinHardware,
  shopPrinterCapabilityList,
  syncPrintersRequestSchema,
  updatePrinterConfigRequestSchema,
} from "@ctrlp/schemas"

import { mergeLiveStatus, mergeShopPrinters } from "./printers"
import type { CloudPrinter, Printer } from "./protocol"

const local: Printer = {
  id: "Microsoft Print to PDF",
  name: "Microsoft Print to PDF",
  isDefault: true,
  status: "ONLINE",
  jobCount: 0,
  portName: "PORTPROMPT:",
  driverName: "Microsoft Print To PDF",
  isShared: false,
  systemName: "Microsoft Print to PDF",
  isColorCapable: true,
  isDuplexCapable: false,
  supportedPaperSizes: ["A4"],
  isWindowsDefault: true,
}

describe("printer shop config", () => {
  it("rejects offering color when the hardware cannot print color", () => {
    expect(() =>
      assertOfferWithinHardware({ color: true }, { isColorCapable: false, supportsA3: false })
    ).toThrow(/cannot offer color/i)
  })

  it("keeps COLOR out of customer capabilities when color is not offered", () => {
    expect(
      shopPrinterCapabilityList({
        enabled: true,
        isColorCapable: true,
        supportsA4: true,
        supportsA3: true,
        offered: { bw: true, color: false, a4: true, a3: true },
      })
    ).toEqual(["A4", "A3"])
  })

  it("omits disabled printers from customer capabilities", () => {
    expect(
      shopPrinterCapabilityList({
        enabled: false,
        isColorCapable: true,
        supportsA4: true,
        supportsA3: false,
        offered: { bw: true, color: true, a4: true, a3: false },
      })
    ).toEqual([])
  })

  it("requires agentId on sync and accepts PAUSED", () => {
    const parsed = syncPrintersRequestSchema.safeParse({
      agentId: "abcdefgh",
      printers: [
        {
          name: "Microsoft Print to PDF",
          isColorCapable: true,
          maximumCopies: 1,
          isDefault: true,
          status: "PAUSED",
        },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it("accepts a PATCH that only toggles offered color", () => {
    const parsed = updatePrinterConfigRequestSchema.safeParse({ offered: { color: false } })
    expect(parsed.success).toBe(true)
  })

  it("merges shop default and enabled flags onto local rows without wiping hardware", () => {
    const cloud: CloudPrinter[] = [
      {
        id: "printer-1",
        name: "Microsoft Print to PDF",
        systemName: "Microsoft Print to PDF",
        status: "ONLINE",
        isDefault: true,
        enabled: false,
        offered: { bw: true, color: false, a4: true, a3: false },
        isColorCapable: true,
        isDuplexCapable: false,
        supportedPaperSizes: ["A4"],
        capabilities: [],
        activeJobsCount: 2,
        maximumCopies: 1,
      },
    ]
    const merged = mergeShopPrinters([local], cloud)
    expect(merged[0]?.isShopDefault).toBe(true)
    expect(merged[0]?.enabled).toBe(false)
    expect(merged[0]?.isColorCapable).toBe(true)
    expect(merged[0]?.cloudId).toBe("printer-1")
  })

  it("updates live status without resetting shop config", () => {
    const current = mergeShopPrinters([local], [
      {
        id: "printer-1",
        name: local.name,
        systemName: local.systemName ?? local.name,
        status: "ONLINE",
        isDefault: true,
        enabled: true,
        offered: { bw: true, color: true, a4: true, a3: false },
        isColorCapable: true,
        isDuplexCapable: false,
        supportedPaperSizes: ["A4"],
        capabilities: ["A4", "COLOR"],
        activeJobsCount: 0,
        maximumCopies: 1,
      },
    ])
    const next = mergeLiveStatus(current, [{ ...local, status: "PRINTING", jobCount: 3 }])
    expect(next[0]?.status).toBe("PRINTING")
    expect(next[0]?.jobCount).toBe(3)
    expect(next[0]?.isShopDefault).toBe(true)
    expect(next[0]?.offered?.color).toBe(true)
  })
})
