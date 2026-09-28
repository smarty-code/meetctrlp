import { Badge } from "@ctrlp/ui/badge"
import { Button } from "@ctrlp/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ctrlp/ui/card"

import type { PrintJob } from "../lib/protocol"

export function PrintQueueScreen({
  jobs,
  busy,
  onCancel,
  onRetry,
}: {
  jobs: PrintJob[]
  busy: boolean
  onCancel: (id: string) => void
  onRetry: (id: string) => void
}) {
  const visible = [...jobs].sort((left, right) => right.createdAt - left.createdAt)
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-heading">Print queue</h1>
        <p className="text-ash">Local agent work survives the desktop window. Retry failed work only after fixing the printer issue.</p>
      </div>
      {visible.length === 0 ? (
        <Card className="rounded-[12px]">
          <CardContent className="pt-6 text-ash">The local print queue is empty.</CardContent>
        </Card>
      ) : (
        visible.map((job) => {
          const terminal = job.state === "completed" || job.state === "cancelled"
          return (
            <Card key={job.id} className="rounded-[12px]">
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>{job.documentName ?? "Queued document"}</CardTitle>
                  <CardDescription>{job.printerId ?? "No printer selected"} · {job.copies} {job.copies === 1 ? "copy" : "copies"}</CardDescription>
                </div>
                <Badge>{job.state}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {job.error ? <p className="w-full text-caption text-destructive">{job.error}</p> : null}
                {job.state === "failed" ? (
                  <Button size="sm" className="rounded-[12px]" disabled={busy} onClick={() => onRetry(job.id)}>
                    Retry
                  </Button>
                ) : null}
                {!terminal && job.state !== "printing" ? (
                  <Button size="sm" variant="outline" className="rounded-[12px]" disabled={busy} onClick={() => onCancel(job.id)}>
                    Cancel
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
