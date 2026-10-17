import type { CSSProperties, ReactNode } from "react"

type TicketCardProps = {
  children: ReactNode
  /** Max width utility for the card, for example "max-w-3xl". */
  widthClass?: string
  /** Padding utilities for the card body. */
  paddingClass?: string
  /** Entrance delay in ms. */
  delayMs?: number
}

/**
 * Perforated ticket: rounded top corners and a scalloped tear-off bottom edge drawn with a
 * CSS mask (`.ticket-edge`). The drop shadow sits on the wrapper so it follows the notches.
 */
export function TicketCard({
  children,
  widthClass = "max-w-3xl",
  paddingClass = "p-8 md:p-12",
  delayMs = 200,
}: TicketCardProps) {
  return (
    <div
      className={`rise-in ticket-shadow relative z-10 mx-auto w-full ${widthClass}`}
      style={{ "--delay": `${delayMs}ms` } as CSSProperties}
    >
      <div className={`rounded-t-2xl bg-surface ${paddingClass} pb-10 md:pb-14`}>{children}</div>
      <div aria-hidden="true" className="ticket-edge bg-surface" />
    </div>
  )
}
