import type { BoardResponse } from "./cloud"
import type { CloudPrintJob, ShopOrder } from "./protocol"

// Keeps the order board current without any timer through the server (implementation plan 8.4): a
// full fetch on start, then `?since=` deltas when the agent says the doorbell rang, only while the
// window is visible. A ring while hidden just marks the board dirty for the next focus.

export const RING_DEBOUNCE_MS = 300
export const STALE_AFTER_MS = 60_000
export const NUDGE_EVERY_MS = 60_000

export type BoardSyncOptions = {
  fetch: (since: string | null) => Promise<BoardResponse>
  apply: (response: BoardResponse) => void
  isVisible: () => boolean
  onError?: (error: unknown) => void
  now?: () => number
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export class BoardSync {
  private cursor: string | null = null
  private dirty = false
  private lastFetchAt = 0
  private debounce: unknown = null
  private inFlight: Promise<void> | null = null
  private again = false
  private readonly now: () => number
  private readonly setTimer: (callback: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void

  constructor(private readonly options: BoardSyncOptions) {
    this.now = options.now ?? Date.now
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  /** The full board, as on start. */
  load() {
    this.cursor = null
    return this.refresh()
  }

  /** The agent's `board.changed`: debounced, and deferred while the window is hidden. */
  changed() {
    if (!this.options.isVisible()) {
      this.dirty = true
      return
    }
    if (this.debounce !== null) {
      this.clearTimer(this.debounce)
    }
    this.debounce = this.setTimer(() => {
      this.debounce = null
      void this.refresh()
    }, RING_DEBOUNCE_MS)
  }

  /** Focus, restore or a visibility change: catch up if a ring was missed or the board is old. */
  shown() {
    if (!this.options.isVisible()) {
      return
    }
    if (this.dirty || this.now() - this.lastFetchAt > STALE_AFTER_MS) {
      void this.refresh()
    }
  }

  /** Fetches the board (full the first time, then deltas). Overlapping calls collapse into one more. */
  refresh(): Promise<void> {
    if (this.inFlight) {
      this.again = true
      return this.inFlight
    }
    this.inFlight = (async () => {
      do {
        this.again = false
        this.dirty = false
        try {
          const response = await this.options.fetch(this.cursor)
          this.cursor = response.cursor
          this.lastFetchAt = this.now()
          this.options.apply(response)
        } catch (error) {
          this.dirty = true
          this.options.onError?.(error)
          break
        }
      } while (this.again)
    })().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  dispose() {
    if (this.debounce !== null) {
      this.clearTimer(this.debounce)
      this.debounce = null
    }
  }
}

function ageMs(value: string | null | undefined, now: number) {
  const at = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(at) ? now - at : 0
}

/**
 * True when the board shows work this PC's agent should already have taken: a QUEUED job for it, or
 * a paid online order waiting for auto-accept, for more than a minute. That points at a lost doorbell
 * ring; the UI then sends the agent `sync.request` (implementation plan 8.4).
 */
export function hasStaleWork(input: {
  orders: ShopOrder[]
  jobs: CloudPrintJob[]
  agentId: string | null
  autoAcceptPaidOnline: boolean
  now: number
}) {
  const staleJob = input.agentId !== null && input.jobs.some((job) =>
    job.status === "QUEUED" && job.agentId === input.agentId && ageMs(job.updatedAt ?? job.createdAt, input.now) > STALE_AFTER_MS
  )
  const stalePaid = input.autoAcceptPaidOnline && input.orders.some((order) =>
    order.status === "SUBMITTED" &&
    order.payment.method === "ONLINE" &&
    order.payment.status === "PAID" &&
    ageMs(order.lifecycle.paidAt ?? order.updatedAt, input.now) > STALE_AFTER_MS
  )
  return staleJob || stalePaid
}

/** At most one nudge a minute, so a job the agent can't take doesn't trigger a sync on every fetch. */
export function createNudger(nudge: () => void, now: () => number = Date.now) {
  let last = Number.NEGATIVE_INFINITY
  return (stale: boolean) => {
    if (stale && now() - last >= NUDGE_EVERY_MS) {
      last = now()
      nudge()
    }
  }
}
