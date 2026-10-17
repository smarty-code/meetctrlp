"use client"

import { useEffect, useState } from "react"
import { ui } from "@/config/ui"
import { conceptCopy } from "@/content/concepts"
import { sampleData } from "@/content/sampleData"
import { DesktopConcept } from "@/components/concepts/DesktopConcept"
import { PhoneConcept } from "@/components/concepts/PhoneConcept"
import { ConceptCaption, ConceptTag } from "@/components/ui/ConceptTag"
import { PaymentChip } from "@/components/concepts/parts"
import type { QueueState } from "@/components/concepts/desktopScreens"
import { describe } from "@/lib/concepts"
import { useInView, usePageVisible } from "@/lib/hooks/useInView"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"

type Phase = "idle" | "press" | "travel" | "paid" | "printing"

const { press, travel, toPrinting, total } = ui.heroLoop

/** Loop timeline (PRD 5.1): each phase and how long it lasts; durations add up to the 6s loop. */
const timeline: ReadonlyArray<readonly [Phase, number]> = [
  ["idle", press],
  ["press", press / 2],
  ["travel", travel],
  ["paid", toPrinting],
  ["printing", total - press - press / 2 - travel - toPrinting],
]

const finalPhase: Phase = "printing"

function queueFor(phase: Phase): QueueState {
  const arrived = phase === "paid" || phase === "printing"
  return {
    arrived,
    print: phase === "printing" ? "printing" : arrived ? "queued" : "none",
  }
}

/** Hero composition (PRD 5.1): the shop desktop with the customer's phone in front, on a 6s loop. */
export function HeroScene() {
  const reduced = useReducedMotion()
  const pageVisible = usePageVisible()
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.1 })
  const running = !reduced && pageVisible && inView
  const [step, setStep] = useState(timeline.length - 1)

  useEffect(() => {
    if (!running) return
    const duration = timeline[step]?.[1] ?? press
    const timer = window.setTimeout(
      () => setStep((current) => (current + 1) % timeline.length),
      duration
    )
    return () => window.clearTimeout(timer)
  }, [running, step])

  const phase = running ? (timeline[step]?.[0] ?? finalPhase) : finalPhase
  const chipState =
    phase === "press" ? "start" : phase === "travel" ? "travel" : undefined

  return (
    <figure
      ref={ref}
      className="relative mx-auto aspect-hero-art w-full max-w-hero-art"
    >
      <ConceptCaption description={describe(conceptCopy.a11y.heroScene)} />
      <ConceptTag className="end-0 top-0" />
      <div aria-hidden="true">
        <DesktopConcept
          screen="queue"
          queue={queueFor(phase)}
          figure={false}
          className="absolute end-0 top-12 w-11/12"
        />
        <PhoneConcept
          screen="pay"
          pressed={phase === "press"}
          figure={false}
          className="absolute start-0 bottom-0 z-10 w-2/5 tilt lg:w-1/3"
        />
        <span
          data-state={chipState}
          className="hero-chip absolute z-20 rounded-pill bg-surface px-3 py-1.5 shadow-card"
        >
          <span className="text-caption font-semibold tabular">
            {sampleData.primaryOrder.id}
          </span>{" "}
          {phase === "travel" && <PaymentChip payment="paid" />}
        </span>
      </div>
    </figure>
  )
}
