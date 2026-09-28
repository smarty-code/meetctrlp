import { Badge } from "@ctrlp/ui/badge"
import { Button } from "@ctrlp/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlp/ui/card"
import { Label } from "@ctrlp/ui/label"
import { Switch } from "@ctrlp/ui/switch"
import { cn } from "@ctrlp/ui/utils"

import { hardwarePaper } from "../lib/printers"
import type { Printer } from "../lib/protocol"

function statusTone(status: string) {
  const value = status.toUpperCase()
  if (value === "ONLINE" || value === "PRINTING") {
    return "online"
  }
  if (value === "PAUSED") {
    return "paused"
  }
  return "problem"
}

function joinList(values?: string[] | null) {
  return values && values.length > 0 ? values.join(", ") : "Not reported"
}

export function PrintersScreen({
  printers,
  busy,
  onRefresh,
  onTest,
  onOpen,
  selected,
  onClose,
  onToggleEnabled,
  onToggleOffered,
  onSetDefault,
}: {
  printers: Printer[]
  busy: boolean
  onRefresh: () => void
  onTest: (printer: Printer) => void
  onOpen: (printer: Printer) => void
  selected: Printer | null
  onClose: () => void
  onToggleEnabled: (printer: Printer, enabled: boolean) => void
  onToggleOffered: (printer: Printer, offered: { color?: boolean; a3?: boolean }) => void
  onSetDefault: (printer: Printer) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body text-ash">
          Windows reports hardware. You choose what this shop offers to customers.
        </p>
        <Button variant="outline" className="rounded-[12px]" onClick={onRefresh} disabled={busy}>
          {busy ? "Rediscovering" : "Rediscover"}
        </Button>
      </div>

      {printers.length === 0 ? (
        <Card className="rounded-[12px] border-graphite">
          <CardContent className="pt-6 text-ash">
            No printers found on this PC yet. Install a printer in Windows, then Rediscover.
          </CardContent>
        </Card>
      ) : (
        printers.map((printer) => {
          const paper = hardwarePaper(printer)
          const tone = statusTone(printer.status)
          const enabled = printer.enabled !== false
          return (
            <Card
              key={printer.id}
              className="cursor-pointer rounded-[12px] border-graphite"
              onClick={() => onOpen(printer)}
            >
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-heading-sm font-bold text-midnight">
                    {printer.name}
                  </CardTitle>
                  <CardDescription>
                    {printer.driverName ?? "Unknown driver"} · {printer.portName ?? "No port"}
                  </CardDescription>
                </div>
                <StatusPill status={printer.status} reason={printer.statusReason} tone={tone} />
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {printer.isShopDefault ? <Badge>Shop default</Badge> : null}
                  <Badge variant={enabled ? "outline" : "destructive"}>
                    {enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge variant="outline">
                    {printer.isColorCapable ? "Color" : "B&W only"}
                  </Badge>
                  {paper.supportsA4 ? <Badge variant="outline">A4</Badge> : null}
                  {paper.supportsA3 ? <Badge variant="outline">A3</Badge> : null}
                  {printer.isDuplexCapable ? <Badge variant="outline">Duplex</Badge> : null}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-caption text-ash">{printer.jobCount} spooler jobs</p>
                  <Button
                    size="sm"
                    className="rounded-[12px]"
                    onClick={(event) => {
                      event.stopPropagation()
                      onTest(printer)
                    }}
                  >
                    Queue test job
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      {selected ? (
        <PrinterDrawer
          printer={selected}
          busy={busy}
          onClose={onClose}
          onToggleEnabled={onToggleEnabled}
          onToggleOffered={onToggleOffered}
          onSetDefault={onSetDefault}
        />
      ) : null}
    </div>
  )
}

function StatusPill({
  status,
  reason,
  tone,
}: {
  status: string
  reason?: string | null
  tone: "online" | "paused" | "problem"
}) {
  return (
    <div className="text-right">
      <span
        className={cn(
          "inline-flex items-center rounded-[12px] border px-2 py-1 text-caption font-bold uppercase",
          tone === "online" && "border-primary text-midnight",
          tone === "paused" && "border-macaw-blue text-macaw-blue",
          tone === "problem" && "border-destructive text-destructive"
        )}
      >
        {status}
      </span>
      {reason ? <p className="mt-1 text-caption text-macaw-blue">{reason}</p> : null}
    </div>
  )
}

function PrinterDrawer({
  printer,
  busy,
  onClose,
  onToggleEnabled,
  onToggleOffered,
  onSetDefault,
}: {
  printer: Printer
  busy: boolean
  onClose: () => void
  onToggleEnabled: (printer: Printer, enabled: boolean) => void
  onToggleOffered: (printer: Printer, offered: { color?: boolean; a3?: boolean }) => void
  onSetDefault: (printer: Printer) => void
}) {
  const paper = hardwarePaper(printer)
  const enabled = printer.enabled !== false
  const offered = printer.offered ?? {
    bw: true,
    color: printer.isColorCapable === true,
    a4: true,
    a3: paper.supportsA3,
  }
  const options = printer.options

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-midnight/20"
        aria-label="Close printer details"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-graphite bg-paper">
        <div className="flex items-start justify-between gap-3 border-b border-graphite p-4">
          <div>
            <p className="text-caption tracking-[0.69px] text-ash">Printer</p>
            <h3 className="text-heading-sm font-bold text-midnight">{printer.name}</h3>
            <p className="text-caption text-ash">
              {printer.driverName ?? "Unknown driver"} · {printer.portName ?? "No port"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-[12px]" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          <section className="space-y-3">
            <h4 className="text-body font-bold text-midnight">Shop offer</h4>
            <ToggleRow
              label="Enabled for this shop"
              checked={enabled}
              disabled={busy}
              onCheckedChange={(value) => onToggleEnabled(printer, value)}
            />
            <ToggleRow
              label="Offer color"
              checked={offered.color}
              disabled={busy || !printer.isColorCapable}
              onCheckedChange={(value) => onToggleOffered(printer, { color: value })}
            />
            <ToggleRow
              label="Offer A3"
              checked={offered.a3}
              disabled={busy || !paper.supportsA3}
              onCheckedChange={(value) => onToggleOffered(printer, { a3: value })}
            />
            <Button
              className="w-full rounded-[12px]"
              disabled={busy || !enabled || printer.isShopDefault}
              onClick={() => onSetDefault(printer)}
            >
              {printer.isShopDefault ? "Shop default" : "Set as shop default"}
            </Button>
          </section>

          <section className="space-y-2">
            <h4 className="text-body font-bold text-midnight">Hardware</h4>
            <Spec label="Status" value={`${printer.status}${printer.statusReason ? ` · ${printer.statusReason}` : ""}`} />
            <Spec label="Color modes" value={joinList(options?.colorModes)} />
            <Spec label="Paper" value={joinList(options?.paperSizeLabels?.length ? options.paperSizeLabels : options?.paperSizes)} />
            <Spec label="Trays" value={joinList(options?.inputTrays)} />
            <Spec label="Quality" value={joinList(options?.printQualities)} />
            <Spec
              label="Copies"
              value={`${options?.copiesMin ?? 1}–${options?.copiesMax ?? printer.maximumCopies ?? 1}`}
            />
            <Spec label="Duplex" value={printer.isDuplexCapable ? joinList(options?.duplexModes) : "Not available"} />
            <Spec
              label="Windows default"
              value={printer.isWindowsDefault || printer.isDefault ? "Yes" : "No"}
            />
          </section>
        </div>
      </aside>
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-graphite px-3 py-3">
      <Label className="text-body text-charcoal">{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-caption text-ash">
      <span className="font-bold text-charcoal">{label}: </span>
      {value}
    </p>
  )
}
