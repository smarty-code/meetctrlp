import type { ReactNode } from "react"
import { conceptCopy } from "@/content/concepts"
import type { PaymentState } from "@/content/sampleData"
import { Chip } from "@/components/ui/Chip"
import { paymentLabel } from "@/lib/concepts"
import { cn } from "@/lib/cn"

/**
 * Small look-alike pieces used inside concept screens. They are pictures of UI,
 * so nothing here is focusable or interactive.
 */

export function UiButton({
  children,
  tone = "lime",
  pressed = false,
  className,
}: {
  children: ReactNode
  tone?: "lime" | "outline" | "ink"
  pressed?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-ui-lg px-3 py-2.5 text-ui-xs font-semibold transition-transform duration-micro ease-standard",
        tone === "lime" && "bg-lime text-ink",
        tone === "outline" && "border border-line text-ink",
        tone === "ink" && "bg-ink text-bg",
        pressed && "scale-95 bg-lime-hover",
        className
      )}
    >
      {children}
    </span>
  )
}

export function PaymentChip({ payment }: { payment: PaymentState }) {
  return (
    <Chip tone={payment === "paid" ? "paid" : "pending"}>
      {paymentLabel(payment)}
    </Chip>
  )
}

export function PrintingChip() {
  return (
    <Chip tone="info">
      <span className="soft-pulse size-1.5 rounded-pill bg-chip-info-fg" />
      {conceptCopy.status.printing}
    </Chip>
  )
}

/** Thin indeterminate progress bar for a job that is printing. */
export function ProgressBar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative block h-1 overflow-hidden rounded-pill bg-surface-sunken",
        className
      )}
    >
      <span className="indeterminate absolute inset-y-0 start-0 w-2/5 rounded-pill bg-lime-deep" />
    </span>
  )
}

export function StatusDot({ tone = "ok" }: { tone?: "ok" | "off" }) {
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-pill",
        tone === "ok" ? "bg-lime-deep" : "bg-line"
      )}
    />
  )
}

export function PanelTitle({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        "text-ui-2xs font-semibold tracking-wide text-ink-faint uppercase",
        className
      )}
    >
      {children}
    </p>
  )
}

export function Amount({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn("font-semibold tabular", className)}>{children}</span>
  )
}
