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
import { ClipboardList, LayoutDashboard, Printer, Settings } from "lucide-react"

import {
  clearStoredRefreshToken,
  enqueueJob,
  getAgentStatus,
  getHostIdentity,
  getHostTelemetry,
  getStoredRefreshToken,
  isTauriRuntime,
  listJobs,
  listPrinters,
  pingAgent,
  refreshPrinters,
  storeRefreshToken,
  waitForAgent,
} from "./lib/agent"
import {
  fetchShopProfile,
  fetchShopStaff,
  loginOwner,
  logoutSession,
  markDeviceOffline,
  refreshSession,
  registerDevice,
  registerOwner,
  sendDeviceHeartbeat,
} from "./lib/cloud"
import { shopError, shopLog, shopWarn } from "./lib/debug"
import {
  appVersion,
  type AgentStatus,
  type AuthSession,
  type CloudLinkState,
  type PrintJob,
  type Printer as PrinterModel,
  type ShopProfile,
  type ShopStaffMember,
  type ShopUser,
} from "./lib/protocol"
import { LoginScreen } from "./screens/LoginScreen"

type Screen = "dashboard" | "printers" | "jobs" | "settings"

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "printers", label: "Printers", icon: Printer },
  { id: "jobs", label: "Print queue", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings },
] as const

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [user, setUser] = useState<ShopUser | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [shop, setShop] = useState<ShopProfile | null>(null)
  const [staff, setStaff] = useState<ShopStaffMember[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [hostName, setHostName] = useState<string | null>(null)
  const [cloud, setCloud] = useState<CloudLinkState>("offline")
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>("dashboard")
  const [status, setStatus] = useState<AgentStatus>({ state: "starting" })
  const [printers, setPrinters] = useState<PrinterModel[]>([])
  const [jobs, setJobs] = useState<PrintJob[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sessionRef = useRef({ idToken: null as string | null, deviceId: null as string | null })

  sessionRef.current = { idToken, deviceId }

  async function persistSession(session: AuthSession) {
    setUser(session.user)
    setIdToken(session.tokens.idToken)
    if (isTauriRuntime()) {
      await storeRefreshToken(session.tokens.refreshToken)
    }
  }

  async function loadShopContext(token: string) {
    const [profile, staffResult] = await Promise.all([
      fetchShopProfile(token),
      fetchShopStaff(token),
    ])
    setShop(profile.shop)
    setStaff(staffResult.staff)
  }

  async function connectDevice(token: string, nextPrinters: PrinterModel[]) {
    if (!isTauriRuntime()) {
      setCloud("offline")
      setCloudMessage("Open with pnpm desktop:dev to register this PC.")
      return
    }

    try {
      const identity = await getHostIdentity()
      setHostName(identity.hostname)
      const registered = await registerDevice(token, identity)
      setDeviceId(registered.deviceId)
      setCloud("connected")
      setCloudMessage(null)
      shopLog("device", "registered", registered.deviceId, identity.hostname)
      await beatOnce(token, registered.deviceId, nextPrinters)
    } catch (err) {
      shopWarn("device", "register failed", err)
      setCloud("offline")
      setCloudMessage(err instanceof Error ? err.message : String(err))
    }
  }

  async function beatOnce(token: string, currentDeviceId: string, nextPrinters: PrinterModel[]) {
    const telemetry = await getHostTelemetry().catch(() => ({ memoryWorkingSetBytes: 0 }))
    await sendDeviceHeartbeat(token, {
      deviceId: currentDeviceId,
      memoryWorkingSetBytes: telemetry.memoryWorkingSetBytes,
      spoolerJobCount: nextPrinters.reduce((sum, printer) => sum + printer.jobCount, 0),
      onlinePrinterCount: nextPrinters.filter((printer) => printer.status !== "offline").length,
    })
    setCloud("connected")
    setCloudMessage(null)
  }

  async function enterSession(session: AuthSession) {
    await persistSession(session)
    await loadShopContext(session.tokens.idToken)
    const nextPrinters = isTauriRuntime() ? await listPrinters().catch(() => []) : []
    const nextJobs = isTauriRuntime() ? await listJobs().catch(() => []) : []
    setPrinters(nextPrinters)
    setJobs(nextJobs)
    await connectDevice(session.tokens.idToken, nextPrinters)
  }

  async function restoreSession() {
    shopLog("auth", "restore begin")
    if (isTauriRuntime()) {
      const agent = await waitForAgent().catch((err) => {
        shopWarn("auth", "agent wait failed", err)
        return getAgentStatus().catch(() => ({ state: "starting" }) as AgentStatus)
      })
      setStatus(agent)
      const refreshToken = await getStoredRefreshToken().catch(() => null)
      if (!refreshToken) {
        shopLog("auth", "no stored refresh token")
        return
      }
      const session = await refreshSession(refreshToken)
      await enterSession(session)
      return
    }

    shopLog("auth", "browser preview; skipping credential restore")
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await restoreSession()
      } catch (err) {
        shopWarn("auth", "restore failed", err)
        if (isTauriRuntime()) {
          await clearStoredRefreshToken().catch(() => undefined)
        }
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

  useEffect(() => {
    if (!idToken || !deviceId) {
      return
    }

    const timer = window.setInterval(() => {
      void (async () => {
        try {
          await beatOnce(idToken, deviceId, printers)
        } catch (err) {
          shopWarn("device", "heartbeat failed", err)
          setCloud("reconnecting")
          setCloudMessage(err instanceof Error ? err.message : String(err))
        }
      })()
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [idToken, deviceId, printers])

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
      setPrinters(nextPrinters)
      setJobs(nextJobs)
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
      shopLog("ui", "poll status", nextStatus.state, {
        printers: nextStatus.printerCount,
        queued: nextStatus.queuedJobs,
      })
      setStatus(nextStatus)
    } catch (err) {
      shopWarn("ui", "poll status failed", err)
    }
  }

  useEffect(() => {
    if (!user) {
      return
    }
    shopLog("ui", "shell mount", { tauri: isTauriRuntime() })
    void refreshAll(true)
    const timer = window.setInterval(() => {
      void pollStatus()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [user])

  async function handleAuthSession(session: AuthSession) {
    setAuthBusy(true)
    setError(null)
    try {
      await enterSession(session)
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

  async function handleSignOut() {
    const current = sessionRef.current
    shopLog("auth", "sign out")
    try {
      if (current.idToken && current.deviceId) {
        await markDeviceOffline(current.idToken, current.deviceId).catch((err) => {
          shopWarn("device", "offline failed", err)
        })
      }
      if (current.idToken) {
        await logoutSession(current.idToken).catch((err) => {
          shopWarn("auth", "logout failed", err)
        })
      }
    } finally {
      if (isTauriRuntime()) {
        await clearStoredRefreshToken().catch(() => undefined)
      }
      setUser(null)
      setIdToken(null)
      setShop(null)
      setStaff([])
      setDeviceId(null)
      setCloud("offline")
      setPrinters([])
      setJobs([])
      setError(null)
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
      setPrinters(await refreshPrinters())
    } catch (err) {
      shopError("ui", "rediscover failed", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleTestJob(printer?: PrinterModel) {
    shopLog("ui", "enqueue test job", printer?.id)
    setError(null)
    try {
      await enqueueJob({
        printerId: printer?.id,
        documentName: "scaffold-test.txt",
        copies: 1,
      })
      setJobs(await listJobs())
    } catch (err) {
      shopError("ui", "enqueue failed", err)
      setError(err instanceof Error ? err.message : String(err))
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
          <CloudPill state={cloud} message={cloudMessage} />
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
            <p className="text-body text-ash">
              Signed in as {user.name}. Shop identity lives in Firebase Auth and
              Firestore.
            </p>
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
            onPing={() => void handlePing()}
            tauri={isTauriRuntime()}
          />
        ) : null}
        {screen === "printers" ? (
          <Printers
            printers={printers}
            onRefresh={() => void handleRefreshPrinters()}
            onTest={(printer) => void handleTestJob(printer)}
          />
        ) : null}
        {screen === "jobs" ? (
          <Jobs jobs={jobs} onEnqueue={() => void handleTestJob()} />
        ) : null}
        {screen === "settings" ? (
          <SettingsPanel
            status={status}
            user={user}
            shop={shop}
            hostName={hostName}
            deviceId={deviceId}
          />
        ) : null}
      </main>
    </div>
  )
}

function CloudPill({ state, message }: { state: CloudLinkState; message: string | null }) {
  const label =
    state === "connected" ? "Connected" : state === "reconnecting" ? "Reconnecting" : "Offline"
  return (
    <div className="rounded-[12px] border border-graphite px-3 py-3">
      <p className="text-caption text-ash">Shop cloud</p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            state === "connected"
              ? "bg-primary"
              : state === "reconnecting"
                ? "bg-macaw-blue"
                : "bg-destructive"
          )}
        />
        <span className="text-body font-bold">{label}</span>
      </div>
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
  onPing,
  tauri,
}: {
  status: AgentStatus
  shop: ShopProfile | null
  staff: ShopStaffMember[]
  printers: PrinterModel[]
  jobs: PrintJob[]
  onPing: () => void
  tauri: boolean
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Shop</CardTitle>
          <CardDescription>{shop?.status ?? "Unknown status"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-heading-sm font-bold text-midnight">{shop?.name ?? "—"}</p>
          <p className="text-caption text-ash">{shop?.email ?? shop?.phone ?? "No contact yet"}</p>
          <p className="text-caption text-ash">{shop?.address ?? "Address is managed on the web dashboard."}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
          <CardDescription>Active operators on this shop</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {staff.length === 0 ? (
            <p className="text-caption text-ash">No staff loaded.</p>
          ) : (
            staff.map((member) => (
              <p key={member.id} className="text-body">
                {member.name} · {member.role}
              </p>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Agent</CardTitle>
          <CardDescription>
            {tauri ? "Tauri runtime connected" : "Browser preview only"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge>{status.state}</Badge>
          <p className="text-caption text-ash">
            Protocol {status.protocolVersion ?? "—"} · Agent{" "}
            {status.agentVersion ?? "—"}
          </p>
          <p className="text-caption text-ash">
            {printers.length} printers · {jobs.length} local jobs
          </p>
          <Button variant="outline" onClick={onPing}>
            Ping agent
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Printers({
  printers,
  onRefresh,
  onTest,
}: {
  printers: PrinterModel[]
  onRefresh: () => void
  onTest: (printer: PrinterModel) => void
}) {
  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onRefresh}>
        Rediscover printers
      </Button>
      {printers.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-ash">
            No printers reported yet. Confirm the agent is running on Windows.
          </CardContent>
        </Card>
      ) : (
        printers.map((printer) => (
          <Card key={printer.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{printer.name}</CardTitle>
                <CardDescription>
                  {printer.driverName ?? "Unknown driver"} ·{" "}
                  {printer.portName ?? "No port"}
                </CardDescription>
              </div>
              <Badge>{printer.status}</Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-caption text-ash">
                {printer.isDefault ? "Default printer" : "Installed printer"} ·{" "}
                {printer.jobCount} spooler jobs
              </p>
              <Button size="sm" onClick={() => onTest(printer)}>
                Queue test job
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

function Jobs({
  jobs,
  onEnqueue,
}: {
  jobs: PrintJob[]
  onEnqueue: () => void
}) {
  return (
    <div className="space-y-4">
      <Button onClick={onEnqueue}>Enqueue test job</Button>
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-ash">
            The local queue is empty. Jobs created here are handled by the C#
            agent.
          </CardContent>
        </Card>
      ) : (
        jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>{job.documentName ?? job.id}</CardTitle>
                <CardDescription>{job.id}</CardDescription>
              </div>
              <Badge>{job.state}</Badge>
            </CardHeader>
          </Card>
        ))
      )}
    </div>
  )
}

function SettingsPanel({
  status,
  user,
  shop,
  hostName,
  deviceId,
}: {
  status: AgentStatus
  user: ShopUser
  shop: ShopProfile | null
  hostName: string | null
  deviceId: string | null
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Shop identity</CardTitle>
          <CardDescription>Read-only on desktop. Edit the profile on the web dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-body">
          <p>Shop: {shop?.name ?? "—"}</p>
          <p>Status: {shop?.status ?? "—"}</p>
          <p>Operator: {user.name} ({user.role})</p>
          <p>Email: {user.email ?? "—"}</p>
          <p>Phone: {user.phone ?? "—"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>This PC</CardTitle>
          <CardDescription>
            JSON-RPC 2.0, 4-byte little-endian frames, Windows named pipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-body">
          <p>Hostname: {hostName ?? "—"}</p>
          <p>Device id: {deviceId ?? "not registered"}</p>
          <p>Pipe: {status.pipeName ?? "not connected"}</p>
          <p>App: CtrlP {appVersion}</p>
          <p>Uptime: {status.uptimeMs ? `${Math.round(status.uptimeMs / 1000)}s` : "—"}</p>
          <p>Agent log: %LOCALAPPDATA%\Ctrlp\PrintAgent\agent.log</p>
        </CardContent>
      </Card>
    </div>
  )
}
