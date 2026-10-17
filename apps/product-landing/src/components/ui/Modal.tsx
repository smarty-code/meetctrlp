"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"
import { cn } from "@/lib/cn"

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  children: ReactNode
  className?: string
}

/**
 * Accessible modal on the native <dialog>: focus is trapped, Escape closes,
 * and focus returns to the opener when it closes (PRD 7.1).
 */
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  className,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={cn(
        "m-auto w-full max-w-lg rounded-xl bg-surface p-0 text-ink shadow-card backdrop:bg-forest/60",
        className
      )}
    >
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-display-m">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-tap shrink-0 items-center justify-center rounded-pill border border-line text-body hover:bg-surface-sunken"
            aria-label={closeLabel}
          >
            <span aria-hidden="true" className="text-h3">
              {"×"}
            </span>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
