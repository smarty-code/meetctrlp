import { cva, type VariantProps } from "class-variance-authority"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

/** Status chip: soft fill plus text, never colour alone (PRD 4.3, 7.1). */
export const chipVariants = cva(
  "inline-flex items-center gap-1 rounded-pill font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        paid: "bg-chip-paid-bg text-chip-paid-fg",
        pending: "bg-chip-pending-bg text-chip-pending-fg",
        error: "bg-chip-error-bg text-chip-error-fg",
        info: "bg-chip-info-bg text-chip-info-fg",
        neutral: "bg-surface-sunken text-ink-soft",
        lime: "bg-lime-soft text-ink",
        forest: "bg-forest text-ink-on-forest",
        outline: "border border-ink text-ink",
      },
      size: {
        ui: "px-2 py-0.5 text-ui-2xs",
        caption: "px-3 py-1 text-caption",
      },
    },
    defaultVariants: { tone: "neutral", size: "ui" },
  }
)

export function Chip({
  tone,
  size,
  className,
  children,
}: VariantProps<typeof chipVariants> & {
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn(chipVariants({ tone, size }), className)}>
      {children}
    </span>
  )
}
