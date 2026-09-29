import { useState } from "react"
import { Badge } from "@ctrlp/ui/badge"
import { Button } from "@ctrlp/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ctrlp/ui/card"

import { mergeQueue, type QueueEntry } from "../lib/dashboard"
import type { CloudPrintJob, PrintJob, Printer } from "../lib/protocol"

export function PrintQueueScreen({
  jobs,
  cloudJobs,
  printers,
  busy,
  onCancel,
  onRetry,
  onReassign,
}: {
  jobs: PrintJob[]
  cloudJobs: CloudPrintJob[]
  printers: Printer[]
  busy: boolean
  onCancel: (id: string) => void
  onRetry: (entry: QueueEntry, printerId?: string) => void
  onReassign: (entry: QueueEntry, printerId: string) => void
}) {
  const [selected, setSelected] = useState<QueueEntry | null>(null)
  const visible = mergeQueue(jobs, cloudJobs)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-heading">Print queue</h1>
        <p className="text-ash">
          Local and cloud jobs are one list. Pause/resume is omitted because Windows cannot safely pause an in-flight GDI job.
        </p>
      </div>
      {visible.length === 0 ? (
        <Card className="rounded-[12px]">
          <CardContent className="pt-6 text-ash">The print queue is empty.</CardContent>
        </Card>
      ) : (
        visible.map((entry) => {
          const terminal = entry.state === "completed" || entry.state === "cancelled"
          const printing = entry.state === "printing"
          return (
            <Card key={entry.key} className="rounded-[12px]">
              <CardHeader className="flex-row items-start justify-between">
                <button type="button" className="text-left" onClick={() => setSelected(entry)}>
                  <CardTitle>{entry.documentName}</CardTitle>
                  <CardDescription>
                    {entry.printerName} · {entry.pagesPrinted ?? 0}/{entry.pagesTotal ?? 0} pages
                  </CardDescription>
                </button>
                <Badge>{entry.state}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {entry.error ? <p className="w-full text-caption text-destructive">{entry.error}</p> : null}
                {entry.state === "failed" ? (
                  <Button size="sm" className="rounded-[12px]" disabled={busy} onClick={() => onRetry(entry)}>
                    Retry
                  </Button>
                ) : null}
                {!terminal && !printing && entry.local ? (
                  <Button size="sm" variant="outline" className="rounded-[12px]" disabled={busy} onClick={() => onCancel(entry.local!.id)}>
                    Cancel
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" className="rounded-[12px]" onClick={() => setSelected(entry)}>
                  Details
                </Button>
              </CardContent>
            </Card>
          )
        })
      )}
      {selected ? (
        <QueueDrawer
          entry={selected}
          printers={printers}
          busy={busy}
          onClose={() => setSelected(null)}
          onRetry={onRetry}
          onReassign={onReassign}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  )
}

function QueueDrawer({
  entry,
  printers,
  busy,
  onClose,
  onRetry,
  onReassign,
  onCancel,
}: {
  entry: QueueEntry
  printers: Printer[]
  busy: boolean
  onClose: () => void
  onRetry: (entry: QueueEntry, printerId?: string) => void
  onReassign: (entry: QueueEntry, printerId: string) => void
  onCancel: (id: string) => void
}) {
  const [printerId, setPrinterId] = useState(entry.cloud?.printerId ?? printers.find((printer) => printer.enabled !== false)?.cloudId ?? "")
  const started = entry.local?.startedAt
    ? new Date(entry.local.startedAt).toLocaleString()
    : entry.cloud?.startedAt
      ? new Date(entry.cloud.startedAt).toLocaleString()
      : "Not started"
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-midnight/20" aria-label="Close job details" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-graphite bg-paper">
        <div className="flex items-start justify-between gap-3 border-b border-graphite p-4">
          <div>
            <p className="text-caption text-ash">Job</p>
            <h3 className="text-heading-sm font-bold text-midnight">{entry.documentName}</h3>
          </div>
          <Button variant="outline" size="sm" className="rounded-[12px]" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-body">
          <p>Printer: {entry.printerName}</p>
          <p>State: {entry.state}</p>
          <p>Progress: {entry.pagesPrinted ?? 0}/{entry.pagesTotal ?? 0}</p>
          <p>Started: {started}</p>
          {entry.error ? <p className="text-destructive">{entry.error}</p> : null}
          {entry.cloud?.errorCode === "PRINT_JOB_STATUS_CONFLICT" || entry.error?.includes("another device") ? (
            <p className="text-caption text-ash">Another device claimed this job. Retry only after that lease ends.</p>
          ) : null}
          {entry.state === "failed" ? (
            <div className="space-y-2">
              <select
                value={printerId}
                onChange={(event) => setPrinterId(event.target.value)}
                className="h-9 w-full rounded-[12px] border border-graphite bg-paper px-3"
              >
                {printers
                  .filter((printer) => printer.enabled !== false && printer.cloudId)
                  .map((printer) => (
                    <option key={printer.id} value={printer.cloudId}>
                      {printer.name}
                    </option>
                  ))}
              </select>
              <Button className="w-full rounded-[12px]" disabled={busy} onClick={() => onRetry(entry, printerId)}>
                Retry
              </Button>
              <Button variant="outline" className="w-full rounded-[12px]" disabled={busy || !printerId} onClick={() => onReassign(entry, printerId)}>
                Reassign
              </Button>
            </div>
          ) : null}
          {entry.local && entry.state !== "printing" && entry.state !== "completed" && entry.state !== "cancelled" ? (
            <Button variant="outline" className="w-full rounded-[12px]" disabled={busy} onClick={() => onCancel(entry.local!.id)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
