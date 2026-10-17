import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

/** Site container (PRD 4.5): max 1200, side padding 20 / 32 / 48. */
export function Container({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-site px-gutter sm:px-gutter-md lg:px-gutter-lg",
        className
      )}
    >
      {children}
    </div>
  )
}

/** 12 / 8 / 4 column grid (PRD 4.5). */
export function Grid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-4 gap-4 sm:grid-cols-8 sm:gap-5 lg:grid-cols-12 lg:gap-6",
        className
      )}
    >
      {children}
    </div>
  )
}
