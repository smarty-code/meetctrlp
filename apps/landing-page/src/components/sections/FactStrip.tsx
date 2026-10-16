"use client"

import React from "react"
import { getVerifiedFactClaims } from "@/content/claims"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"

export function FactStrip() {
  const verifiedClaims = getVerifiedFactClaims()
  const isReducedMotion = usePrefersReducedMotion()

  // If no claims are verified yet (since defaults are false in PRD 6.2), render graceful factual fallback
  const displayItems =
    verifiedClaims.length > 0
      ? verifiedClaims
      : [
          "Upload PDF, DOCX, PPTX, JPG or PNG",
          "No account needed",
          "Colour or black & white",
          "Choose copies and pages",
          "See the price before you pay",
          "Pay online or at the shop",
          "Track your order",
        ]

  return (
    <section
      id="facts"
      aria-label="Product facts"
      className="relative w-full border-y border-line bg-surface overflow-hidden py-4 sm:py-5"
    >
      {/* 64px Mask Gradient on Edges for Desktop / Tablet */}
      <div className="absolute inset-y-0 left-0 w-12 sm:w-20 bg-gradient-to-r from-surface to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 sm:w-20 bg-gradient-to-l from-surface to-transparent z-10 pointer-events-none" />

      {isReducedMotion ? (
        /* Reduced motion: Static wrapped list */
        <div className="max-w-[1200px] mx-auto px-6">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm sm:text-base font-medium text-ink-soft">
            {displayItems.map((item, index) => (
              <li key={index} className="flex items-center gap-2">
                {index > 0 && <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        /* Animated linear marquee pausing on hover / focus */
        <div className="flex w-max items-center marquee-track hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
          <ul className="flex items-center gap-8 shrink-0 pr-8 text-sm sm:text-base font-medium text-ink-soft">
            {displayItems.map((item, index) => (
              <li key={`track-1-${index}`} className="flex items-center gap-4">
                <span>{item}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" aria-hidden="true" />
              </li>
            ))}
          </ul>

          {/* Duplicated track for seamless infinite loop (aria-hidden) */}
          <ul
            aria-hidden="true"
            className="flex items-center gap-8 shrink-0 pr-8 text-sm sm:text-base font-medium text-ink-soft select-none"
          >
            {displayItems.map((item, index) => (
              <li key={`track-2-${index}`} className="flex items-center gap-4">
                <span>{item}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
