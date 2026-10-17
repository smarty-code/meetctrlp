"use client"

import { useState } from "react"
import { conceptCopy } from "@/content/concepts"
import { cn } from "@/lib/cn"

export type AccordionItem = {
  id: string
  question: string
  answer: string
  link?: { label: string; href: string }
}

/** Single-open accordion with hairlines and a plus/minus glyph; height animates in 320ms (PRD 5.11). */
export function Accordion({
  items,
  onOpen,
}: {
  items: readonly AccordionItem[]
  onOpen?: (index: number) => void
}) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <ul className="border-b border-line">
      {items.map((item, index) => {
        const expanded = open === index
        const buttonId = `${item.id}-q`
        const panelId = `${item.id}-a`
        return (
          <li key={item.id} className="border-t border-line">
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => {
                  setOpen(expanded ? null : index)
                  if (!expanded) onOpen?.(index)
                }}
                className="flex min-h-tap w-full items-center justify-between gap-6 py-5 text-start text-h3 font-semibold"
              >
                {item.question}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-h3 text-ink-soft"
                >
                  {expanded
                    ? conceptCopy.glyphs.minus
                    : conceptCopy.glyphs.plus}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              data-open={expanded ? "" : undefined}
              inert={!expanded}
              className="accordion-panel"
            >
              <div className="overflow-hidden">
                <p className={cn("max-w-prose pb-6 text-body text-ink-soft")}>
                  {item.answer}
                  {item.link && (
                    <>
                      {" "}
                      <a
                        href={item.link.href}
                        className="text-lime-deep underline underline-offset-2"
                      >
                        {item.link.label}
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
