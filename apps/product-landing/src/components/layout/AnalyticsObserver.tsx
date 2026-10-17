"use client"

import { useEffect } from "react"
import { events, viewThreshold } from "@/config/analytics"
import { sectionIds } from "@/config/routes"
import { track } from "@/lib/track"

/** Reports `section_view` once per section at 50% visibility, plus `plans_view` and `bento_view` (PRD 8). */
export function AnalyticsObserver() {
  useEffect(() => {
    const seen = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (!entry.isIntersecting || seen.has(id)) continue
          seen.add(id)
          track(events.sectionView, { id })
          if (id === sectionIds.plans) track(events.plansView)
          if (id === sectionIds.shops) track(events.bentoView)
        }
      },
      { threshold: viewThreshold }
    )
    document
      .querySelectorAll(`#${sectionIds.main} section[id]`)
      .forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return null
}
