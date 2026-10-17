import { cva, type VariantProps } from "class-variance-authority"
import type { ReactNode } from "react"
import { cn } from "@/lib/cn"
import type { Headline } from "@/types/content"

const headingVariants = cva("font-display text-balance", {
  variants: {
    size: {
      xl: "text-display-xl",
      l: "max-w-headline text-display-l",
      m: "text-display-m",
    },
    tone: {
      light: "text-ink",
      forest: "text-ink-on-forest",
    },
  },
  defaultVariants: { size: "l", tone: "light" },
})

type HeadingProps = VariantProps<typeof headingVariants> & {
  headline: Headline
  as?: "h1" | "h2" | "h3" | "p"
  id?: string
  className?: string
}

/** Display headline with one italic emphasis phrase (PRD 4.4 type devices 1 and 3). */
export function DisplayHeading({
  headline,
  as: Tag = "h2",
  size,
  tone,
  id,
  className,
}: HeadingProps) {
  return (
    <Tag id={id} className={cn(headingVariants({ size, tone }), className)}>
      {headline.lead}{" "}
      {headline.breakBefore && <br className="hidden md:block" />}
      <em
        className={cn(
          "italic",
          tone === "forest" ? "text-lime" : "text-lime-deep"
        )}
      >
        {headline.emphasis}
      </em>
      {headline.tail && <> {headline.tail}</>}
    </Tag>
  )
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn("text-eyebrow text-ink-faint uppercase", className)}>
      {children}
    </p>
  )
}

/** Bracket flourish "( Label )", used only on the hero and the closing block (PRD 4.4). */
export function BracketLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={cn("text-eyebrow uppercase", className)}>
      <span aria-hidden="true">{"( "}</span>
      {children}
      <span aria-hidden="true">{" )"}</span>
    </p>
  )
}

/** Small lime dot used as a list marker instead of icons (PRD 5.3). */
export function LimeDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-pill bg-lime",
        className
      )}
    />
  )
}
