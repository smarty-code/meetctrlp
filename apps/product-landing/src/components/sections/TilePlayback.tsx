"use client"

import { useEffect, useState } from "react"
import { DesktopConcept } from "@/components/concepts/DesktopConcept"
import { useInView } from "@/lib/hooks/useInView"
import { useReducedMotion } from "@/lib/hooks/useReducedMotion"
import { ui } from "@/config/ui"

/**
 * Bento tile B (PRD 5.5): on first view the Accept press turns into [Printing…], once.
 */
export function TilePlayback() {
  const reduced = useReducedMotion()
  const [ref, inView] = useInView<HTMLDivElement>({
    threshold: 0.5,
    once: true,
  })
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!inView) return
    const timer = window.setTimeout(
      () => setPrinting(true),
      ui.heroLoop.toPrinting
    )
    return () => window.clearTimeout(timer)
  }, [inView])

  return (
    <div ref={ref}>
      <DesktopConcept
        screen="job"
        variant="panel"
        job={printing || reduced ? "printing" : "accept"}
        figure={false}
      />
    </div>
  )
}
