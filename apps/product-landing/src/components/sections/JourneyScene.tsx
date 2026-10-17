"use client"

import { useEffect, useRef, useState } from "react"
import { events } from "@/config/analytics"
import { journeyCopy, type JourneyStep, type Lane } from "@/content/steps"
import { Hills } from "@/components/concepts/Hills"
import { ConceptTag } from "@/components/ui/ConceptTag"
import { JourneyVisual } from "@/components/sections/JourneyVisual"
import { formatStep } from "@/lib/format"
import { cn } from "@/lib/cn"
import { track } from "@/lib/track"

export type ResolvedStep = Omit<JourneyStep, "detail"> & {
  detail: string
  description: string
}

const laneChip: Record<Lane, string> = {
  customer: "bg-lime-soft text-ink",
  shop: "bg-forest text-ink-on-forest",
  both: "border border-ink text-ink",
}

/**
 * Journey scroll scene (PRD 5.2). Desktop: steps on the left, a sticky panel on the right whose
 * concept follows the step nearest the viewport centre. Mobile: each step carries its own panel.
 * No scroll hijacking.
 */
export function JourneyScene({ steps }: { steps: readonly ResolvedStep[] }) {
  const [active, setActive] = useState(0)
  const stepRefs = useRef<Array<HTMLLIElement | null>>([])
  const seen = useRef(new Set<number>())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = Number((entry.target as HTMLElement).dataset.index)
          setActive(index)
          if (!seen.current.has(index)) {
            seen.current.add(index)
            track(events.journeyStepView, { step: index + 1 })
          }
        }
      },
      { rootMargin: "-50% 0px -50% 0px" }
    )
    stepRefs.current.forEach((element) => element && observer.observe(element))
    return () => observer.disconnect()
  }, [])

  const activeLane = steps[active]?.lane ?? "customer"
  const handedOff = activeLane !== "customer"

  return (
    <div className="mt-12 grid gap-14 lg:mt-16 lg:grid-cols-12 lg:gap-6">
      <ol
        aria-label={journeyCopy.stepsLabel}
        className="relative flex flex-col gap-14 lg:col-span-5 lg:gap-0 lg:ps-8"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 start-0 hidden w-0.5 bg-line lg:block"
        >
          <span
            className="block h-full origin-top bg-lime transition-transform duration-standard ease-standard"
            style={{ transform: `scaleY(${(active + 1) / steps.length})` }}
          />
        </span>
        {steps.map((step, index) => (
          <li
            key={step.title}
            ref={(element) => {
              stepRefs.current[index] = element
            }}
            data-index={index}
            className={cn(
              "flex flex-col gap-4 transition-opacity duration-standard lg:min-h-journey-step lg:justify-center",
              index === active ? "lg:opacity-100" : "lg:opacity-35"
            )}
          >
            <div className="relative aspect-journey-mobile overflow-hidden rounded-xl bg-surface-sunken lg:hidden">
              <Hills variant="panel" />
              <ConceptTag />
              <JourneyVisual scene={step.scene} />
            </div>
            <div className="flex items-center gap-4">
              <span className="font-display text-step-number text-ink-faint">
                {formatStep(index + 1)}
              </span>
              <span
                className={cn(
                  "rounded-pill px-3 py-1 text-caption",
                  laneChip[step.lane]
                )}
              >
                {journeyCopy.lanes[step.lane]}
              </span>
            </div>
            <h3 className="text-h3 font-semibold">{step.title}</h3>
            <p className="text-body-l">{step.line}</p>
            <p className="max-w-prose text-body text-ink-soft">{step.detail}</p>
            <p className="sr-only">{step.description}</p>
          </li>
        ))}
      </ol>
      <div className="hidden lg:col-span-6 lg:col-start-7 lg:block">
        <div className="sticky top-sticky-top h-sticky-panel overflow-hidden rounded-xl bg-surface-sunken">
          <Hills variant="panel" />
          <LaneIndicator lane={activeLane} handedOff={handedOff} />
          <ConceptTag />
          {steps.map((step, index) => (
            <JourneyVisual
              key={step.title}
              scene={step.scene}
              className={cn(
                "transition-opacity duration-standard ease-standard",
                index === active ? "opacity-100" : "opacity-0"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/** "Customer" and "Shop" pills; a line fills across at the handoff between steps 2 and 3. */
function LaneIndicator({
  lane,
  handedOff,
}: {
  lane: Lane
  handedOff: boolean
}) {
  const pill = (on: boolean) =>
    cn(
      "rounded-pill px-3 py-1 text-caption transition-colors duration-standard",
      on ? "bg-ink text-bg" : "bg-surface text-ink-soft"
    )
  return (
    <div
      aria-hidden="true"
      className="absolute start-6 top-5 z-10 flex items-center gap-2"
    >
      <span className={pill(lane === "customer" || lane === "both")}>
        {journeyCopy.lanes.customer}
      </span>
      <span className="relative h-0.5 w-10 overflow-hidden rounded-pill bg-line">
        <span
          className={cn(
            "absolute inset-0 origin-left bg-lime-deep transition-transform duration-scene ease-standard",
            handedOff ? "scale-x-100" : "scale-x-0"
          )}
        />
      </span>
      <span className={pill(lane === "shop" || lane === "both")}>
        {journeyCopy.lanes.shop}
      </span>
    </div>
  )
}
