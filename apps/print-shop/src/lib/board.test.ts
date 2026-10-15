import { describe, expect, it, vi } from "vitest"

import { BoardSync, NUDGE_EVERY_MS, RING_DEBOUNCE_MS, STALE_AFTER_MS, createNudger, hasStaleWork } from "./board"
import type { BoardResponse } from "./cloud"
import type { CloudPrintJob, ShopOrder } from "./protocol"

function harness(visible = true) {
  let now = 1_000_000
  let isVisible = visible
  const timers: Array<{ at: number; run: () => void }> = []
  const calls: Array<string | null> = []
  const applied: BoardResponse[] = []
  const sync = new BoardSync({
    fetch: async (since) => {
      calls.push(since)
      return { full: since === null, orders: [], jobs: [], cursor: `cursor-${calls.length}` }
    },
    apply: (response) => applied.push(response),
    isVisible: () => isVisible,
    now: () => now,
    setTimer: (run, ms) => {
      const timer = { at: now + ms, run }
      timers.push(timer)
      return timer
    },
    clearTimer: (handle) => {
      const index = timers.indexOf(handle as (typeof timers)[number])
      if (index >= 0) timers.splice(index, 1)
    },
  })
  return {
    sync,
    calls,
    applied,
    setVisible: (value: boolean) => {
      isVisible = value
    },
    advance: async (ms: number) => {
      now += ms
      for (const timer of timers.filter((entry) => entry.at <= now)) {
        timers.splice(timers.indexOf(timer), 1)
        timer.run()
      }
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

describe("board sync", () => {
  it("loads the full board, then fetches deltas with the cursor", async () => {
    const { sync, calls, applied, advance } = harness()
    await sync.load()
    sync.changed()
    await advance(RING_DEBOUNCE_MS)
    await sync.refresh()

    expect(calls[0]).toBeNull()
    expect(calls[1]).toBe("cursor-1")
    expect(applied[0]?.full).toBe(true)
  })

  it("debounces a burst of rings into one fetch", async () => {
    const { sync, calls, advance } = harness()
    await sync.load()
    for (let i = 0; i < 5; i++) {
      sync.changed()
      await advance(100)
    }
    await advance(RING_DEBOUNCE_MS)

    expect(calls).toHaveLength(2)
  })

  it("doesn't fetch while hidden; catches up when shown", async () => {
    const { sync, calls, setVisible, advance } = harness()
    await sync.load()
    setVisible(false)
    sync.changed()
    await advance(RING_DEBOUNCE_MS * 10)
    expect(calls).toHaveLength(1)

    setVisible(true)
    sync.shown()
    await advance(0)
    expect(calls).toHaveLength(2)
  })

  it("refetches on focus only when the board is older than a minute", async () => {
    const { sync, calls, advance } = harness()
    await sync.load()
    sync.shown()
    await advance(0)
    expect(calls).toHaveLength(1)

    await advance(STALE_AFTER_MS + 1)
    sync.shown()
    await advance(0)
    expect(calls).toHaveLength(2)
  })

  it("marks the board dirty after a failed fetch", async () => {
    const onError = vi.fn()
    let fail = true
    const sync = new BoardSync({
      fetch: async () => {
        if (fail) throw new Error("offline")
        return { full: true, orders: [], jobs: [], cursor: "c" }
      },
      apply: () => undefined,
      isVisible: () => true,
      onError,
    })
    await sync.load()
    expect(onError).toHaveBeenCalledOnce()
    fail = false
    const fetched = vi.spyOn(sync, "refresh")
    sync.shown()
    expect(fetched).toHaveBeenCalledOnce()
  })
})

describe("stale-work nudge", () => {
  const now = Date.parse("2026-10-15T10:00:00.000Z")
  const old = new Date(now - STALE_AFTER_MS - 1000).toISOString()
  const recent = new Date(now - 1000).toISOString()

  const job = (agentId: string, updatedAt: string) =>
    ({ id: "j", orderId: "o", status: "QUEUED", agentId, updatedAt, createdAt: updatedAt }) as CloudPrintJob
  const paid = (paidAt: string) =>
    ({
      id: "o",
      status: "SUBMITTED",
      payment: { method: "ONLINE", status: "PAID" },
      lifecycle: { paidAt },
      updatedAt: paidAt,
    }) as unknown as ShopOrder

  it("spots this PC's job left queued for over a minute", () => {
    expect(hasStaleWork({ orders: [], jobs: [job("me", old)], agentId: "me", autoAcceptPaidOnline: false, now })).toBe(true)
    expect(hasStaleWork({ orders: [], jobs: [job("me", recent)], agentId: "me", autoAcceptPaidOnline: false, now })).toBe(false)
    expect(hasStaleWork({ orders: [], jobs: [job("other", old)], agentId: "me", autoAcceptPaidOnline: false, now })).toBe(false)
  })

  it("spots a paid order waiting for auto-accept", () => {
    expect(hasStaleWork({ orders: [paid(old)], jobs: [], agentId: "me", autoAcceptPaidOnline: true, now })).toBe(true)
    expect(hasStaleWork({ orders: [paid(old)], jobs: [], agentId: "me", autoAcceptPaidOnline: false, now })).toBe(false)
    expect(hasStaleWork({ orders: [paid(recent)], jobs: [], agentId: "me", autoAcceptPaidOnline: true, now })).toBe(false)
  })

  it("nudges at most once a minute", () => {
    let clock = 0
    const nudge = vi.fn()
    const maybeNudge = createNudger(nudge, () => clock)
    maybeNudge(true)
    maybeNudge(true)
    expect(nudge).toHaveBeenCalledOnce()
    clock += NUDGE_EVERY_MS
    maybeNudge(false)
    maybeNudge(true)
    expect(nudge).toHaveBeenCalledTimes(2)
  })
})
