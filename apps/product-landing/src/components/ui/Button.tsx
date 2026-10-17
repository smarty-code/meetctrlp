import { cva, type VariantProps } from "class-variance-authority"
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/cn"

/** Buttons (PRD 4.3): lime primary, ink-outlined secondary, a quiet text link. */
export const buttonVariants = cva(
  "group inline-flex min-h-tap items-center justify-center gap-2 rounded-pill px-6 text-small font-semibold whitespace-nowrap transition-colors duration-micro ease-standard select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "bg-lime text-ink hover:bg-lime-hover focus-visible:outline-ink",
        secondary:
          "border border-ink text-ink hover:bg-ink hover:text-bg focus-visible:outline-ink",
        secondaryOnForest:
          "border border-ink-on-forest text-ink-on-forest hover:bg-ink-on-forest hover:text-forest focus-visible:outline-ink-on-forest",
        quiet:
          "min-h-tap px-2 text-ink-soft hover:text-ink focus-visible:outline-ink",
      },
      size: {
        default: "",
        compact: "px-4",
      },
      block: {
        true: "w-full sm:w-auto",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "default", block: false },
  }
)

export type ButtonStyleProps = VariantProps<typeof buttonVariants>

/** The link arrow "→" that nudges on hover (PRD 4.8). */
export function LinkArrow({ glyph }: { glyph: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block transition-transform duration-micro ease-standard group-hover:translate-x-1"
    >
      {glyph}
    </span>
  )
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & ButtonStyleProps) {
  return (
    <a
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  )
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  )
}
