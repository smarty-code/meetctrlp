import { useEffect, useRef, useState } from "react"
import { Badge } from "@ctrlp/ui/badge"
import { Button } from "@ctrlp/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlp/ui/card"
import { cn } from "@ctrlp/ui/utils"
import { ClipboardList, FileText, LayoutDashboard, Printer, Settings } from "lucide-react"

import {
  agentNotify,
  clearStoredRefreshToken,
  cancelJob,
  exportAgentLog,
  getAgentIdToken,
  getAgentStatus,
  getHostIdentity,
  isTauriRuntime,
  listJobs,
  listPrinters,
  listenAgentEvents,
  listenAgentReady,
  pingAgent,
  printTestPage,
  refreshPrinters,
  retryJob,
  storeRefreshToken,
  waitForAgent,
  type AgentCloudState,
} from "./lib/agent"
import { BoardSync, createNudger, hasStaleWork } from "./lib/board"
import {
  fetchBoard,
  fetchCurrentUser,
  fetchOrderHistory,
  fetchShopProfile,
  fetchShopConfig,
  fetchShopStaff,
  getDocumentDownloadUrl,
  getShopOrder,
  listShopPrinters,
  listOrderPrintJobs,
  loginOwner,
  logoutSession,
  markDeviceOffline,
  patchShopPrinter,
  registerDevice,
  registerOwner,
  routeOrderPrintJob,
  searchShopOrders,
  sendPrinterTelemetry,
  serverBaseUrl,
  dispatchOrderPrintJob,
  rejectShopOrder,
  recordCashPayment,
  retryOrderPrintJob,
  cancelOrderPrintJob,
  syncShopPrinters,
  transitionShopOrder,
  updateOrderAutomation,
  updateShopCapabilities,
  updateShopHours,
  updateShopPricing,
  updateShopProfile,
} from "./lib/cloud"
import { cancelQueueEntry, cancelTarget, dashboardMetrics, isStuckCloudJob, mergeQueue, retryTarget, rupees } from "./lib/dashboard"
import { shopError, shopLog, shopWarn } from "./lib/debug"
import { emptyOrderStore, notifyPrinterOffline, reduceOrderEvent, type OrderStore } from "./lib/orders"
import {
  cloudPrinterStatus,
  mergeLiveStatus,
  mergeShopPrinters,
  telemetrySignature,
  toSyncPrinter,
} from "./lib/printers"
import {
  appVersion,
  type AgentStatus,
  type AuthSession,
  type CloudPrintJob,
  type OrderAutomation,
  type PrintJob,
  type Printer as PrinterModel,
  type ShopConfig,
  type ShopProfile,
  type ShopOrder,
  type ShopStaffMember,
  type ShopUser,
} from "./lib/protocol"
import { clearLoginToken, onSignedOut, seedLoginToken } from "./lib/session"
import { LoginScreen } from "./screens/LoginScreen"
import { OrderDetailsScreen } from "./screens/OrderDetailsScreen"
import { OrdersScreen } from "./screens/OrdersScreen"
import { PrintQueueScreen } from "./screens/PrintQueueScreen"
import { PrintersScreen } from "./screens/PrintersScreen"
import { SettingsScreen } from "./screens/SettingsScreen"

type Screen = "dashboard" | "orders" | "printers" | "jobs" | "settings"

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: FileText },
  { id: "printers", label: "Printers", icon: Printer },
  { id: "jobs", label: "Print queue", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings },
] as const

/** Tells the agent which server and doorbell to use. Sent on boot and whenever the agent (re)connects. */
function configureAgent() {
  return agentNotify({
    method: "cloud.configure",
    params: {
      serverBaseUrl,
      firebaseApiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
      databaseUrl: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? "",
    },
  })
}

function confirmRescue(job: CloudPrintJob | undefined) {
  // A job DISPATCHING for 15 minutes is usually on a PC that died, but a large job may still be printing.
  return !isStuckCloudJob(job) || window.confirm(
    "This job has been with another PC for over 15 minutes and may still be printing there. Send it again?"
  )
}

function confirmCancel(job: CloudPrintJob | undefined) {
  return !isStuckCloudJob(job) || window.confirm(
    "This job has been with another PC for over 15 minutes and may still be printing there. Cancel it anyway?"
  )
}

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [user, setUser] = useState<ShopUser | null>(null)
  const [shop, setShop] = useState<ShopProfile | null>(null)
  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null)
  const [staff, setStaff] = useState<ShopStaffMember[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [hostName, setHostName] = useState<string | null>(null)
  const [cloudState, setCloudState] = useState<AgentCloudState | null>(null)
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>("dashboard")
  const [status, setStatus] = useState<AgentStatus>({ state: "starting" })
  const [printers, setPrinters] = useState<PrinterModel[]>([])
  const [jobs, setJobs] = useState<PrintJob[]>([])
  const [orderStore, setOrderStore] = useState<OrderStore>(emptyOrderStore)
  const [selectedOrder, setSelectedOrder] = useState<ShopOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterModel | null>(null)
  const sessionRef = useRef({
    deviceId: null as string | null,
    shopId: null as string | null,
  })
  const telemetryRef = useRef(new Map<string, string>())
  const printersRef = useRef<PrinterModel[]>([])
  const orderStoreRef = useRef<OrderStore>(emptyOrderStore)
  const boardRef = useRef<BoardSync | null>(null)
  const nudgeRef = useRef(
    createNudger(() => {
      shopLog("board", "stale work on the board; asking the agent to sync")
      void agentNotify({ method: "sync.request" }).catch((err) => shopWarn("board", "sync.request failed", err))
    })
  )

  sessionRef.current = { deviceId, shopId: user?.shopId ?? null }
  printersRef.current = printers
  orderStoreRef.current = orderStore

  function applyPrinters(next: PrinterModel[]) {
    setPrinters((previous) => {
      for (const printer of next) {
        const before = previous.find((entry) => entry.id === printer.id)
        if (before && before.status.toUpperCase() !== "OFFLINE" && printer.status.toUpperCase() === "OFFLINE") {
          setOrderStore((store) => notifyPrinterOffline(store, printer.name))
        }
      }
      return next
    })
    printersRef.current = next
    setSelectedPrinter((current) =>
      current ? (next.find((printer) => printer.id === current.id) ?? current) : null
    )
  }

  async function loadShopContext() {
    const [profile, staffResult] = await Promise.all([fetchShopProfile(), fetchShopStaff()])
    setShop(profile.shop)
    setStaff(staffResult.staff)
    setShopConfig(await fetchShopConfig(profile.shop.id))
  }

  /**
   * Registers this PC and hands the agent the session, so it can listen to the shop's doorbell and
   * call the API as this user. `login` seeds the agent with a fresh login's token (no refresh needed).
   */
  async function connectDevice(
    shopId: string,
    nextPrinters: PrinterModel[],
    login?: { token: string; expiresAt: number }
  ) {
    if (!isTauriRuntime()) {
      setCloudMessage("Open with pnpm desktop:dev to register this PC.")
      return
    }

    try {
      const identity = await getHostIdentity()
      setHostName(identity.hostname)
      const registered = await registerDevice(identity)
      await agentNotify({
        method: "cloud.session",
        params: {
          shopId,
          agentId: registered.deviceId,
          ...(login ? { idToken: login.token, expiresAt: login.expiresAt } : {}),
        },
      })
      clearLoginToken()
      setDeviceId(registered.deviceId)
      sessionRef.current = { deviceId: registered.deviceId, shopId }
      setCloudMessage(null)
      shopLog("device", "registered", registered.deviceId, identity.hostname)
      await syncDiscoveredPrinters(shopId, registered.deviceId, nextPrinters, true)
    } catch (err) {
      shopWarn("device", "register failed", err)
      setCloudMessage(err instanceof Error ? err.message : String(err))
    }
  }

  async function syncDiscoveredPrinters(shopId: string, agentId: string, local: PrinterModel[], refresh = false) {
    if (!shopId) {
      applyPrinters(local)
      return local
    }

    const discovered = refresh ? await refreshPrinters() : local
    if (discovered.length === 0) {
      applyPrinters(discovered)
      return discovered
    }
    await syncShopPrinters(shopId, { agentId, printers: discovered.map(toSyncPrinter) })
    const cloud = await listShopPrinters(shopId)
    const merged = mergeShopPrinters(discovered, cloud.printers)
    applyPrinters(merged)
    await reportPrinterTelemetry(shopId, merged)
    return merged
  }

  async function reportPrinterTelemetry(shopId: string, nextPrinters: PrinterModel[]) {
    for (const printer of nextPrinters) {
      if (!printer.cloudId) {
        continue
      }
      const signature = telemetrySignature(printer)
      const previous = telemetryRef.current.get(printer.cloudId)
      if (!previous) {
        telemetryRef.current.set(printer.cloudId, signature)
        continue
      }
      if (previous === signature) {
        continue
      }
      const previousStatus = previous.split("|")[1] ?? cloudPrinterStatus(printer.status)
      try {
        await sendPrinterTelemetry(shopId, printer.cloudId, {
          previousStatus,
          newStatus: cloudPrinterStatus(printer.status),
          errorDescription: printer.statusReason ?? null,
          activeSpoolJobs: printer.jobCount,
        })
        telemetryRef.current.set(printer.cloudId, signature)
      } catch (err) {
        shopWarn("printers", "telemetry failed", printer.name, err)
      }
    }
  }

  async function enterSession(signedIn: ShopUser, login?: { token: string; expiresAt: number }) {
    setUser(signedIn)
    sessionRef.current = { deviceId: null, shopId: signedIn.shopId }
    await loadShopContext()
    const nextPrinters = isTauriRuntime() ? await listPrinters().catch(() => []) : []
    const nextJobs = isTauriRuntime() ? await listJobs().catch(() => []) : []
    applyPrinters(nextPrinters)
    setJobs(nextJobs)
    await connectDevice(signedIn.shopId, nextPrinters, login)
  }

  /** Boot: the agent holds this PC's login. If it has none, show the login screen (implementation plan 8.3). */
  async function restoreSession() {
    shopLog("auth", "restore begin")
    if (!isTauriRuntime()) {
      shopLog("auth", "browser preview; skipping credential restore")
      return
    }

    const agent = await waitForAgent().catch((err) => {
      shopWarn("auth", "agent wait failed", err)
      return getAgentStatus().catch(() => ({ state: "starting" }) as AgentStatus)
    })
    setStatus(agent)
    await configureAgent()
    const token = await getAgentIdToken(false).catch(() => ({ signedIn: false }))
    if (!token.signedIn) {
      shopLog("auth", "agent has no signed-in user")
      return
    }
    const { user: current } = await fetchCurrentUser()
    await enterSession(current)
  }

  /** The login is gone (revoked, expired or invalid): forget it on this PC and show the login screen. */
  function resetSession(message: string | null) {
    clearLoginToken()
    setUser(null)
    setShop(null)
    setShopConfig(null)
    setStaff([])
    setDeviceId(null)
    setCloudState(null)
    setCloudMessage(null)
    setPrinters([])
    setSelectedPrinter(null)
    setJobs([])
    setOrderStore(emptyOrderStore)
    setSelectedOrder(null)
    setError(message)
  }

  const signedOutRef = useRef<() => void>(() => undefined)
  signedOutRef.current = () => {
    if (!sessionRef.current.shopId) {
      return
    }
    shopWarn("auth", "sign-in is no longer valid")
    if (isTauriRuntime()) {
      void agentNotify({ method: "cloud.clear" }).catch(() => undefined)
      void clearStoredRefreshToken().catch(() => undefined)
    }
    resetSession("Your sign-in has expired. Sign in again.")
  }

  useEffect(() => {
    onSignedOut(() => signedOutRef.current())
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await restoreSession()
      } catch (err) {
        shopWarn("auth", "restore failed", err)
      } finally {
        if (!cancelled) {
          setBootstrapping(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // The board: full on start, then deltas after the doorbell rings, only while visible (plan 8.4).
  useEffect(() => {
    if (!user) {
      return
    }

    const board = new BoardSync({
      fetch: (since) => fetchBoard(user.shopId, since),
      apply: (response) =>
        setOrderStore((current) =>
          reduceOrderEvent(current, {
            type: response.full ? "BOARD_SNAPSHOT" : "BOARD_DELTA",
            orders: response.orders,
            jobs: response.jobs,
          })
        ),
      isVisible: () => document.visibilityState === "visible",
      onError: (err) => shopWarn("board", "fetch failed", err),
    })
    boardRef.current = board
    void board.load()
    const shown = () => board.shown()
    document.addEventListener("visibilitychange", shown)
    window.addEventListener("focus", shown)
    return () => {
      document.removeEventListener("visibilitychange", shown)
      window.removeEventListener("focus", shown)
      board.dispose()
      boardRef.current = null
    }
  }, [user])

  // A lost ring leaves work the agent should have taken; nudge it at most once a minute.
  useEffect(() => {
    if (!user || !isTauriRuntime()) {
      return
    }
    nudgeRef.current(
      hasStaleWork({
        orders: orderStore.orders,
        jobs: Object.values(orderStore.jobsByOrderId).flat(),
        agentId: deviceId,
        autoAcceptPaidOnline: shopConfig?.orderAutomation.autoAcceptPaidOnline ?? false,
        now: Date.now(),
      })
    )
  }, [deviceId, orderStore, shopConfig, user])

  async function refreshAll(userInitiated = false) {
    shopLog("ui", "refreshAll begin", { userInitiated, busy })
    if (userInitiated) {
      setBusy(true)
    }
    setError(null)
    try {
      const nextStatus = await getAgentStatus()
      shopLog("ui", "status", nextStatus)
      setStatus(nextStatus)
      if (nextStatus.state === "disconnected" || nextStatus.state === "starting") {
        shopWarn("ui", "agent not ready; skipping printer/job fetch", nextStatus.state)
        setPrinters([])
        setJobs([])
        return
      }

      const nextPrinters = await listPrinters()
      const nextJobs = await listJobs()
      shopLog("ui", "inventory", {
        printers: nextPrinters.length,
        jobs: nextJobs.length,
      })
      applyPrinters(mergeLiveStatus(printersRef.current, nextPrinters))
      setJobs(nextJobs)
      if (userInitiated) {
        await boardRef.current?.refresh()
      }
    } catch (err) {
      shopError("ui", "refreshAll failed", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (userInitiated) {
        setBusy(false)
      }
      shopLog("ui", "refreshAll end", { userInitiated })
    }
  }

  async function pollStatus() {
    try {
      const nextStatus = await getAgentStatus()
      setStatus(nextStatus)
    } catch (err) {
      shopWarn("ui", "poll status failed", err)
    }
  }

  async function pollPrinters() {
    try {
      const live = await listPrinters()
      const merged = mergeLiveStatus(printersRef.current, live)
      applyPrinters(merged)
      const current = sessionRef.current
      if (current.shopId) {
        // Sent only when a printer's state actually changed.
        await reportPrinterTelemetry(current.shopId, merged)
      }
    } catch (err) {
      shopWarn("ui", "poll printers failed", err)
    }
  }

  useEffect(() => {
    if (!user) {
      return
    }
    shopLog("ui", "shell mount", { tauri: isTauriRuntime() })
    void refreshAll(true)
    // Both talk to the local agent over the pipe, not to the server.
    const statusTimer = window.setInterval(() => {
      void pollStatus()
    }, 15_000)
    const printerTimer = window.setInterval(() => {
      void pollPrinters()
    }, 60_000)
    return () => {
      window.clearInterval(statusTimer)
      window.clearInterval(printerTimer)
    }
  }, [user])

  // Agent notifications: local job progress, the doorbell's board.changed, and cloud.state.
  useEffect(() => {
    if (!isTauriRuntime()) {
      return
    }

    let unlisten: (() => void) | undefined
    let disposed = false
    void listenAgentEvents((payload) => {
      const event = payload as { method?: string; params?: unknown }
      if (event.method === "board.changed") {
        boardRef.current?.changed()
        return
      }
      if (event.method === "cloud.state") {
        const state = event.params as AgentCloudState
        setCloudState(state)
        if (state.token === "invalid") {
          signedOutRef.current()
        }
        return
      }
      const job = (event.params as { job?: PrintJob } | undefined)?.job
      if (!event.method?.startsWith("job.") || !job) {
        return
      }
      setJobs((current) => {
        const index = current.findIndex((entry) => entry.id === job.id)
        return index === -1 ? [job, ...current] : current.map((entry) => (entry.id === job.id ? job : entry))
      })
    }).then((stop) => {
      if (disposed) {
        stop()
      } else {
        unlisten = stop
      }
    })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  // agent:ready fires once per app start, when the bridge is up: hand the agent the server and session.
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let disposed = false
    void listenAgentReady(() => {
      void configureAgent().catch((err) => shopWarn("agent", "cloud.configure failed", err))
      const current = sessionRef.current
      if (current.shopId && current.deviceId) {
        void agentNotify({ method: "cloud.session", params: { shopId: current.shopId, agentId: current.deviceId } })
          .catch((err) => shopWarn("agent", "cloud.session failed", err))
      }
    }).then((stop) => {
      if (disposed) {
        stop()
      } else {
        unlisten = stop
      }
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  async function handleAuthSession(session: AuthSession) {
    setAuthBusy(true)
    setError(null)
    try {
      if (isTauriRuntime()) {
        await storeRefreshToken(session.tokens.refreshToken)
        await configureAgent()
      }
      const login = seedLoginToken(session.tokens.idToken, session.tokens.expiresIn)
      await enterSession(session.user, { token: login.token, expiresAt: login.expiresAt })
    } catch (err) {
      shopError("auth", "session enter failed", err)
      setError(err instanceof Error ? err.message : String(err))
      throw err
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogin(identifier: string, password: string) {
    setAuthBusy(true)
    setError(null)
    try {
      await handleAuthSession(await loginOwner(identifier, password))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setAuthBusy(false)
    }
  }

  async function handleRegister(input: {
    name: string
    shopName: string
    identifier: string
    password: string
  }) {
    setAuthBusy(true)
    setError(null)
    try {
      await handleAuthSession(await registerOwner(input))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setAuthBusy(false)
    }
  }

  /** Signs out this PC only (implementation plan 8.3): printers offline, logout, agent cleared, token removed. */
  async function handleSignOut() {
    const current = sessionRef.current
    shopLog("auth", "sign out")
    try {
      if (current.deviceId) {
        await markDeviceOffline(current.deviceId).catch((err) => {
          shopWarn("device", "offline failed", err)
        })
      }
      await logoutSession().catch((err) => {
        shopWarn("auth", "logout failed", err)
      })
    } finally {
      if (isTauriRuntime()) {
        await agentNotify({ method: "cloud.clear" }).catch(() => undefined)
        await clearStoredRefreshToken().catch(() => undefined)
      }
      resetSession(null)
    }
  }

  async function handlePing() {
    shopLog("ui", "ping")
    setError(null)
    try {
      await pingAgent()
      await refreshAll(true)
    } catch (err) {
      shopError("ui", "ping failed", err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleRefreshPrinters() {
    shopLog("ui", "rediscover printers")
    setBusy(true)
    setError(null)
    try {
      const current = sessionRef.current
      if (current.deviceId && current.shopId) {
        await syncDiscoveredPrinters(
          current.shopId,
          current.deviceId,
          printersRef.current,
          true
        )
        return
      }
      applyPrinters(await refreshPrinters())
    } catch (err) {
      shopError("ui", "rediscover failed", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handlePrinterConfig(
    printer: PrinterModel,
    input: { isDefault?: boolean; enabled?: boolean; offered?: { color?: boolean; a3?: boolean } }
  ) {
    const current = sessionRef.current
    if (!current.shopId || !printer.cloudId) {
      throw new Error("This printer is not synced to the shop yet. Rediscover first.")
    }
    setBusy(true)
    setError(null)
    try {
      const saved = await patchShopPrinter(current.shopId, printer.cloudId, input)
      applyPrinters(
        printersRef.current.map((entry) =>
          entry.id === printer.id
            ? {
                ...entry,
                cloudId: saved.id,
                enabled: saved.enabled,
                offered: saved.offered,
                isShopDefault: saved.isDefault,
                capabilities: saved.capabilities,
              }
            : input.isDefault
              ? { ...entry, isShopDefault: false }
              : entry
        )
      )
    } catch (err) {
      shopError("ui", "printer config failed", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function refreshSelectedOrder(order: ShopOrder) {
    const current = sessionRef.current
    if (!current.shopId) {
      return
    }
    const [fresh, jobResult] = await Promise.all([
      getShopOrder(current.shopId, order.id),
      listOrderPrintJobs(current.shopId, order.id),
    ])
    setOrderStore((previous) => {
      let next = reduceOrderEvent(previous, { type: "ORDER_STATUS_CHANGED", order: fresh })
      for (const job of jobResult.jobs) {
        next = reduceOrderEvent(next, { type: "PRINT_JOB_CHANGED", job })
      }
      return next
    })
    setSelectedOrder(fresh)
  }

  async function handleOrderTransition(
    order: ShopOrder,
    action: "accept" | "printing" | "ready" | "complete"
  ) {
    const current = sessionRef.current
    if (!current.shopId) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved = await transitionShopOrder(current.shopId, order.id, action, order.status, current.deviceId)
      setOrderStore((previous) => reduceOrderEvent(previous, { type: "ORDER_STATUS_CHANGED", order: saved }))
      setSelectedOrder(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRejectOrder(order: ShopOrder) {
    const current = sessionRef.current
    if (!current.shopId) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved = await rejectShopOrder(
        current.shopId,
        order.id,
        order.status,
        "Rejected by shop operator"
      )
      setOrderStore((previous) => reduceOrderEvent(previous, { type: "ORDER_STATUS_CHANGED", order: saved }))
      setSelectedOrder(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleDispatchOrderDocument(order: ShopOrder, documentId: string) {
    const current = sessionRef.current
    const document = order.documents.find((entry) => (entry.docId ?? entry.id) === documentId)
    if (!current.shopId || !document) {
      setError("Rediscover and enable a compatible shop printer before printing.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const route = await routeOrderPrintJob(current.shopId, {
        colorMode: document.config?.colorMode ?? document.colorMode,
        paperSize: document.config?.paperSize ?? document.paperSize,
      })
      await dispatchOrderPrintJob(current.shopId, order.id, {
        printerId: route.printerId,
        documentId,
      })
      await refreshSelectedOrder(order)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handlePreviewDocument(order: ShopOrder, documentId: string) {
    const current = sessionRef.current
    if (!current.shopId) {
      return { valid: false, message: "Your shop session is unavailable." }
    }
    try {
      const download = await getDocumentDownloadUrl(current.shopId, order.id, documentId)
      const response = await fetch(download.url)
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`)
      }
      const bytes = await response.arrayBuffer()
      const digest = await crypto.subtle.digest("SHA-256", bytes)
      const actualHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
      if (actualHash !== download.sha256Hash) {
        throw new Error("The downloaded document hash does not match the order.")
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: download.mimeType ?? "application/pdf" }))
      window.open(url, "_blank", "noopener,noreferrer")
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return { valid: true, message: `Validated ${download.pageCount} pages and opened a temporary preview.` }
    } catch (err) {
      return { valid: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  async function handleTestJob(printer?: PrinterModel) {
    shopLog("ui", "print test page", printer?.id)
    setError(null)
    try {
      await printTestPage(printer?.id)
      setJobs(await listJobs())
    } catch (err) {
      shopError("ui", "test page failed", err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCancelQueue(entry: import("./lib/dashboard").QueueEntry) {
    const target = cancelTarget(entry)
    const shopId = sessionRef.current.shopId
    if (!target || (target.kind === "cloud" && !shopId) || !confirmCancel(entry.cloud)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      // A cloud job is cancelled by the server; this PC drops its copy when the sync it asks for says so.
      const cancelled = await cancelQueueEntry(target, {
        cancelCloud: (orderId, jobId) => cancelOrderPrintJob(shopId!, orderId, jobId),
        cancelLocal: (id) => cancelJob(id),
        requestSync: () => void agentNotify({ method: "sync.request" }).catch((err) => shopWarn("queue", "sync.request failed", err)),
      })
      if (cancelled) {
        setOrderStore((store) => reduceOrderEvent(store, { type: "PRINT_JOB_CHANGED", job: cancelled }))
      }
      setJobs(await listJobs())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleCancelOrderJob(job: CloudPrintJob) {
    // The job's queue entry, so a copy waiting on this PC is cancelled here too.
    const entry = mergeQueue(jobs.filter((local) => local.cloudJobId === job.id), [job]).find((candidate) => candidate.cloud?.id === job.id)
    if (entry) {
      await handleCancelQueue(entry)
    }
  }

  async function handleRetryQueue(entry: import("./lib/dashboard").QueueEntry, printerId?: string) {
    const current = sessionRef.current
    if (entry.cloud && !confirmRescue(entry.cloud)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      // A cloud job always goes to the server, even before the board has loaded it: its local lease is spent.
      const target = retryTarget(entry)
      if (!target) {
        throw new Error("This job is missing its order. Retry it from the order's page.")
      }
      if (target.kind === "cloud") {
        if (!current.shopId) return
        const retried = await retryOrderPrintJob(current.shopId, target.orderId, target.jobId, printerId)
        setOrderStore((store) => reduceOrderEvent(store, { type: "PRINT_JOB_CHANGED", job: retried }))
      } else {
        await retryJob(target.id)
      }
      setJobs(await listJobs())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleReassignQueue(entry: import("./lib/dashboard").QueueEntry, printerId: string) {
    await handleRetryQueue(entry, printerId)
  }

  async function handleReassignOrderJob(job: CloudPrintJob, printerId: string) {
    const current = sessionRef.current
    if (!current.shopId || !confirmRescue(job)) return
    setBusy(true)
    setError(null)
    try {
      const retried = await retryOrderPrintJob(current.shopId, job.orderId, job.id, printerId)
      setOrderStore((store) => reduceOrderEvent(store, { type: "PRINT_JOB_CHANGED", job: retried }))
      if (selectedOrder) {
        await refreshSelectedOrder(selectedOrder)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleCashPayment(order: ShopOrder) {
    const current = sessionRef.current
    if (!current.shopId) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const paid = await recordCashPayment(
        current.shopId,
        order.id,
        order.amounts.totalMinorUnits
      )
      setSelectedOrder(paid)
      setOrderStore((store) => reduceOrderEvent(store, { type: "ORDER_STATUS_CHANGED", order: paid }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleOrderAutomation(next: OrderAutomation) {
    const current = sessionRef.current
    if (!current.shopId) return
    setBusy(true)
    setError(null)
    try {
      const saved = await updateOrderAutomation(current.shopId, next)
      setShopConfig((config) => (config ? { ...config, orderAutomation: saved } : config))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveProfile(input: Parameters<typeof updateShopProfile>[0]) {
    setBusy(true)
    setError(null)
    try {
      const result = await updateShopProfile(input)
      setShop(result.shop)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSavePricing(input: { bwA4PricePaise: number; colorA4PricePaise: number; colorA3PricePaise: number }) {
    const current = sessionRef.current
    if (!current.shopId) return
    setBusy(true)
    setError(null)
    try {
      setShopConfig(await updateShopPricing(current.shopId, input))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveHours(hours: NonNullable<ShopConfig["businessHours"]>) {
    const current = sessionRef.current
    if (!current.shopId) return
    setBusy(true)
    setError(null)
    try {
      setShopConfig(await updateShopHours(current.shopId, hours))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveCapabilities(input: { colorPrinting: boolean; a3Printing: boolean }) {
    const current = sessionRef.current
    if (!current.shopId) return
    setBusy(true)
    setError(null)
    try {
      setShopConfig(await updateShopCapabilities(current.shopId, input))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleExportLog() {
    try {
      const result = await exportAgentLog()
      if (result.cancelled) return null
      return result.path
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    }
  }

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-body text-ash">
        Restoring shop session…
      </div>
    )
  }

  if (!user) {
    return (
      <LoginScreen
        busy={authBusy}
        error={error}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    )
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-60 flex-col border-r border-graphite bg-paper p-4">
        <div className="px-2 py-3">
          <p className="text-caption tracking-[0.69px] text-ash">MeetCtrlP</p>
          <h1 className="text-heading-sm font-bold text-midnight">
            {shop?.name ?? "Print Shop"}
          </h1>
          <p className="mt-1 text-caption text-ash">
            {user.name} · {user.role}
          </p>
        </div>
        <nav className="mt-4 flex flex-1 flex-col gap-2">
          {nav.map((item) => {
            const Icon = item.icon
            const active = screen === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setScreen(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-[12px] px-3 py-3 text-left text-body font-bold tracking-[0.8px]",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-charcoal hover:bg-eel-light"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="space-y-3">
          <CloudPill state={cloudState} message={cloudMessage} />
          <StatusPill status={status} />
          <p className="px-1 text-caption text-ash">
            {hostName ?? "This PC"} (v{appVersion})
          </p>
          <Button variant="outline" className="w-full rounded-[12px]" onClick={() => void handleSignOut()}>
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-heading font-bold tracking-[1.7px] text-midnight">
              {nav.find((item) => item.id === screen)?.label}
            </h2>
            <p className="text-body text-ash">Signed in as {user.name}.</p>
          </div>
          <Button onClick={() => void refreshAll(true)} disabled={busy}>
            {busy ? "Refreshing" : "Refresh"}
          </Button>
        </div>

        {error ? (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6 text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {screen === "dashboard" ? (
          <Dashboard
            status={status}
            shop={shop}
            staff={staff}
            printers={printers}
            jobs={jobs}
            orders={orderStore.orders}
            notifications={orderStore.notifications}
            onPing={() => void handlePing()}
            tauri={isTauriRuntime()}
          />
        ) : null}
        {screen === "orders" && !selectedOrder ? (
          <OrdersScreen
            orders={orderStore.orders}
            busy={busy}
            loadHistory={(input) => fetchOrderHistory(user.shopId, input)}
            searchOrders={(q, cursor) => searchShopOrders(user.shopId, q, cursor)}
            onOpen={(order) => {
              setSelectedOrder(order)
              void refreshSelectedOrder(order)
            }}
            onAccept={(order) => void handleOrderTransition(order, "accept")}
            onReject={(order) => void handleRejectOrder(order)}
          />
        ) : null}
        {screen === "orders" && selectedOrder ? (
          <OrderDetailsScreen
            order={selectedOrder}
            jobs={orderStore.jobsByOrderId[selectedOrder.id] ?? []}
            printers={printers}
            busy={busy}
            onBack={() => setSelectedOrder(null)}
            onAccept={() => void handleOrderTransition(selectedOrder, "accept")}
            onReject={() => void handleRejectOrder(selectedOrder)}
            onDispatch={(documentId) => void handleDispatchOrderDocument(selectedOrder, documentId)}
            onReady={() => void handleOrderTransition(selectedOrder, "ready")}
            onComplete={() => void handleOrderTransition(selectedOrder, "complete")}
            onCollectCash={() => void handleCashPayment(selectedOrder)}
            onPreview={(documentId) => handlePreviewDocument(selectedOrder, documentId)}
            onReassign={(job, printerId) => void handleReassignOrderJob(job, printerId)}
            onCancelJob={(job) => void handleCancelOrderJob(job)}
          />
        ) : null}
        {screen === "printers" ? (
          <PrintersScreen
            printers={printers}
            busy={busy}
            onRefresh={() => void handleRefreshPrinters()}
            onTest={(printer) => void handleTestJob(printer)}
            onOpen={setSelectedPrinter}
            selected={selectedPrinter}
            onClose={() => setSelectedPrinter(null)}
            onToggleEnabled={(printer, enabled) => void handlePrinterConfig(printer, { enabled })}
            onToggleOffered={(printer, offered) => void handlePrinterConfig(printer, { offered })}
            onSetDefault={(printer) => void handlePrinterConfig(printer, { isDefault: true })}
          />
        ) : null}
        {screen === "jobs" ? (
          <PrintQueueScreen
            jobs={jobs}
            cloudJobs={Object.values(orderStore.jobsByOrderId).flat()}
            printers={printers}
            busy={busy}
            onCancel={(entry) => void handleCancelQueue(entry)}
            onRetry={(entry, printerId) => void handleRetryQueue(entry, printerId)}
            onReassign={(entry, printerId) => void handleReassignQueue(entry, printerId)}
          />
        ) : null}
        {screen === "settings" ? (
          <SettingsScreen
            status={status}
            user={user}
            shop={shop}
            config={shopConfig}
            printers={printers}
            hostName={hostName}
            deviceId={deviceId}
            cloudState={cloudState}
            onSyncNow={() => void agentNotify({ method: "sync.request" }).catch((err) => setError(err instanceof Error ? err.message : String(err)))}
            queuedJobs={jobs.filter((job) => job.state === "queued" || job.state === "created" || job.state === "printing").length}
            busy={busy}
            onSaveProfile={(input) => handleSaveProfile(input)}
            onSavePricing={(input) => handleSavePricing(input)}
            onSaveHours={(hours) => handleSaveHours(hours)}
            onSaveCapabilities={(input) => handleSaveCapabilities(input)}
            onUpdateAutomation={(automation) => void handleOrderAutomation(automation)}
            onExportLog={() => handleExportLog()}
            onSignOut={() => void handleSignOut()}
          />
        ) : null}
      </main>
    </div>
  )
}

function CloudPill({ state, message }: { state: AgentCloudState | null; message: string | null }) {
  const doorbell = state?.doorbell ?? "offline"
  const label =
    state?.token === "invalid"
      ? "Sign in again"
      : doorbell === "connected"
        ? "Live"
        : doorbell === "polling"
          ? "Checking every minute"
          : doorbell === "connecting"
            ? "Connecting"
            : "Offline"
  const pending = state?.pendingReports ?? 0
  return (
    <div className="rounded-[12px] border border-graphite px-3 py-3">
      <p className="text-caption text-ash">Shop cloud</p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            doorbell === "connected" && state?.token !== "invalid"
              ? "bg-primary"
              : doorbell === "polling" || doorbell === "connecting"
                ? "bg-macaw-blue"
                : "bg-destructive"
          )}
        />
        <span className="text-body font-bold">{label}</span>
      </div>
      {pending > 0 ? (
        <p className="mt-1 text-caption text-ash">
          {pending} print result{pending === 1 ? "" : "s"} waiting to send
        </p>
      ) : null}
      {message ? <p className="mt-1 text-caption text-ash">{message}</p> : null}
    </div>
  )
}

function StatusPill({ status }: { status: AgentStatus }) {
  const connected = status.state === "ready" || status.state === "connected"
  return (
    <div className="rounded-[12px] border border-graphite px-3 py-3">
      <p className="text-caption text-ash">Agent</p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            connected ? "bg-primary" : "bg-destructive"
          )}
        />
        <span className="text-body font-bold capitalize">{status.state}</span>
      </div>
    </div>
  )
}

function Dashboard({
  status,
  shop,
  staff,
  printers,
  jobs,
  orders,
  notifications,
  onPing,
  tauri,
}: {
  status: AgentStatus
  shop: ShopProfile | null
  staff: ShopStaffMember[]
  printers: PrinterModel[]
  jobs: PrintJob[]
  orders: ShopOrder[]
  notifications: import("./lib/protocol").ShopNotification[]
  onPing: () => void
  tauri: boolean
}) {
  const metrics = dashboardMetrics(orders, printers, jobs)
  const defaultPrinter = printers.find((printer) => printer.isShopDefault) ?? printers.find((printer) => printer.enabled !== false)
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
          <CardDescription>Live counts from the order board</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-body">
          <p>{metrics.newCount} new</p>
          <p>{metrics.activeCount} active · {metrics.printingCount} printing</p>
          <p>{metrics.readyCount} ready</p>
          <p>{metrics.completedTodayCount} completed today</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
          <CardDescription>Paid online, cash pending, cash in drawer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-body">
          <p>Paid online today {rupees(metrics.paidOnlineTodayPaise)}</p>
          <p>Cash pending {rupees(metrics.cashPendingPaise)}</p>
          <p>Cash in drawer today {rupees(metrics.cashInDrawerTodayPaise)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Attention</CardTitle>
          <CardDescription>Failed jobs and printer problems</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-body">
          {metrics.attention.length === 0 ? (
            <p className="text-caption text-ash">Nothing needs attention.</p>
          ) : (
            metrics.attention.map((item) => (
              <p key={item} className="text-caption text-destructive">{item}</p>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
          <CardDescription>{shop?.name ?? "This shop"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {metrics.recentOrders.length === 0 ? (
            <p className="text-caption text-ash">No active orders right now.</p>
          ) : (
            metrics.recentOrders.map((order) => (
              <p key={order.id} className="text-body">
                {order.orderNumber} · {order.status} · {rupees(order.amounts.totalMinorUnits)}
              </p>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>New orders, print failures, printer offline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {notifications.length === 0 ? (
            <p className="text-caption text-ash">No alerts yet.</p>
          ) : (
            notifications.slice(0, 8).map((item) => (
              <p key={item.id} className="text-caption">
                <span className="font-bold text-charcoal">{item.title}: </span>
                {item.detail}
              </p>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Staff & agent</CardTitle>
          <CardDescription>{tauri ? "Tauri runtime connected" : "Browser preview only"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {staff.map((member) => (
            <p key={member.id} className="text-body">{member.name} · {member.role}</p>
          ))}
          {staff.length === 0 ? <p className="text-caption text-ash">No staff loaded.</p> : null}
          <Badge>{status.state}</Badge>
          <p className="text-caption text-ash">
            Route via {defaultPrinter?.name ?? "no enabled printer"} · {printers.length} printers · {jobs.length} local jobs
          </p>
          <Button variant="outline" onClick={onPing}>
            Ping agent
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
