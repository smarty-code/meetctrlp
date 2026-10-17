import { cva, type VariantProps } from "class-variance-authority"
import type { ReactNode } from "react"
import type { SectionId } from "@/config/routes"
import { cn } from "@/lib/cn"

const sectionVariants = cva("relative", {
  variants: {
    tone: {
      bg: "bg-bg",
      surface: "bg-surface",
      sunken: "bg-surface-sunken",
      forest: "bg-forest text-ink-on-forest",
    },
    spacing: {
      default: "py-section",
      compact: "py-16 lg:py-24",
      none: "",
    },
    lazy: {
      true: "below-fold",
      false: "",
    },
  },
  defaultVariants: { tone: "bg", spacing: "default", lazy: true },
})

type SectionProps = VariantProps<typeof sectionVariants> & {
  id: SectionId
  children: ReactNode
  className?: string
}

/** A landmark section labelled by its heading (`${id}-title`) (PRD 7.1). */
export function Section({
  id,
  tone,
  spacing,
  lazy,
  className,
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={headingId(id)}
      className={cn(sectionVariants({ tone, spacing, lazy }), className)}
    >
      {children}
    </section>
  )
}

export function headingId(id: SectionId): string {
  return `${id}-title`
}
