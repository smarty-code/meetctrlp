"use client"

import { useRef, type KeyboardEvent, type ReactNode } from "react"
import { cn } from "@/lib/cn"

type Tab<K extends string> = { key: K; label: string; id: string }

type TabsProps<K extends string> = {
  label: string
  tabs: ReadonlyArray<Tab<K>>
  current: K
  onSelect: (key: K) => void
  children: (key: K) => ReactNode
}

/**
 * Pill tab switch with the ARIA tabs pattern: arrow keys, Home and End move between tabs (PRD 5.11, 7.1).
 * Every panel is rendered (inactive ones hidden) so deep links can target them.
 */
export function Tabs<K extends string>({
  label,
  tabs,
  current,
  onSelect,
  children,
}: TabsProps<K>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const last = tabs.length - 1
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    const tab = tabs[next]
    if (!tab) return
    onSelect(tab.key)
    refs.current[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-8">
      <div
        role="tablist"
        aria-label={label}
        className="mx-auto inline-flex rounded-pill border border-line bg-surface p-1"
      >
        {tabs.map((tab, index) => {
          const selected = tab.key === current
          return (
            <button
              key={tab.key}
              ref={(element) => {
                refs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`${tab.id}-tab`}
              aria-selected={selected}
              aria-controls={tab.id}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "min-h-tap rounded-pill px-5 text-small font-semibold transition-colors duration-micro",
                selected ? "bg-ink text-bg" : "text-ink-soft hover:text-ink"
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={tab.id}
          role="tabpanel"
          aria-labelledby={`${tab.id}-tab`}
          hidden={tab.key !== current}
          tabIndex={0}
          className="scroll-mt-32"
        >
          {children(tab.key)}
        </div>
      ))}
    </div>
  )
}
