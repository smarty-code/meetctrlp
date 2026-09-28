import { useEffect, useState } from "react"
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
  enqueueJob,
  getAgentStatus,
  isTauriRuntime,
  listJobs,
  listPrinters,
  pingAgent,
  refreshPrinters,
} from "./lib/agent"
import { shopError, shopLog, shopWarn } from "./lib/debug"
import type { AgentStatus, PrintJob, Printer as PrinterModel } from "./lib/protocol"

type Screen = "dashboard" | "printers" | "jobs" | "settings"

const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "printers", label: "Printers", icon: Printer },
  { id: "jobs", label: "Print queue", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: Settings },
] as const

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard")
  const [status, setStatus] = useState<AgentStatus>({ state: "starting" })
  const [printers, setPrinters] = useState<PrinterModel[]>([])
  const [jobs, setJobs] = useState<PrintJob[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    shopLog("ui", "mount", { tauri: isTauriRuntime() })
    void refreshAll(true)
    const timer = window.setInterval(() => {
      void pollStatus()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

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

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-60 flex-col border-r border-graphite bg-paper p-4">
        <div className="px-2 py-3">
          <p className="text-caption tracking-[0.69px] text-ash">MeetCtrlP</p>
          <h1 className="text-heading-sm font-bold text-midnight">Print Shop</h1>
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
        <StatusPill status={status} />
      </aside>

      <main className="flex-1 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-heading font-bold tracking-[1.7px] text-midnight">
              {nav.find((item) => item.id === screen)?.label}
            </h2>
            <p className="text-body text-ash">
              UI talks to the C# Windows agent over JSON-RPC named pipes.
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
        {screen === "settings" ? <SettingsPanel status={status} /> : null}
      </main>
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
  printers,
  jobs,
  onPing,
  tauri,
}: {
  status: AgentStatus
  printers: PrinterModel[]
  jobs: PrintJob[]
  onPing: () => void
  tauri: boolean
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
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
          <Button variant="outline" onClick={onPing}>
            Ping agent
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Printers</CardTitle>
          <CardDescription>Discovered through winspool.drv</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-heading font-bold">{printers.length}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <CardDescription>Local jobs held by the agent</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-heading font-bold">{jobs.length}</p>
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

function SettingsPanel({ status }: { status: AgentStatus }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Local IPC</CardTitle>
        <CardDescription>
          JSON-RPC 2.0, 4-byte little-endian frames, Windows named pipe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-body">
        <p>Pipe: {status.pipeName ?? "not connected"}</p>
        <p>Uptime: {status.uptimeMs ? `${Math.round(status.uptimeMs / 1000)}s` : "—"}</p>
        <p>Queued jobs: {status.queuedJobs ?? 0}</p>
        <p>Agent log: %LOCALAPPDATA%\Ctrlp\PrintAgent\agent.log</p>
        <p>UI logs: DevTools console (Ctrl+Shift+I). Rust/agent lines are in the desktop:dev terminal.</p>
      </CardContent>
    </Card>
  )
}
