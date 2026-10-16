"use client"

import React from "react"
import Link from "next/link"
import { siteCopy } from "@/content/copy"
import { Hills } from "@/components/concepts/Hills"
import { ConceptTag } from "@/components/concepts/ConceptTag"
import { PhoneConcept } from "@/components/concepts/PhoneConcept"
import { DesktopConcept } from "@/components/concepts/DesktopConcept"
import { trackEvent } from "@/lib/analytics"

export function DoorsSection() {
  const { doors } = siteCopy

  return (
    <section
      id="doors"
      className="py-20 sm:py-28 lg:py-36 bg-bg"
      aria-label="Two doors: user and print shop entrances"
    >
      <div className="max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Heading */}
        <div className="max-w-2xl">
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
            {doors.eyebrow}
          </span>
          <h2 className="mt-4 font-display text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em] text-ink">
            {doors.h2Start}
            <span className="italic text-lime-deep">{doors.h2Emphasis}</span>
            {doors.h2End}
          </h2>
        </div>

        {/* Two Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-14">
          {/* DOOR A: FOR PEOPLE PRINTING */}
          <div className="group relative min-h-[540px] sm:min-h-[580px] bg-surface rounded-3xl border border-line p-8 sm:p-10 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
            <ConceptTag />
            <Hills variant="panel" />

            {/* Top Text Content */}
            <div className="relative z-10 max-w-sm">
              <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
                {doors.doorA.label}
              </span>
              <h3 className="mt-3 font-display text-3xl sm:text-4xl text-ink">
                {doors.doorA.titleStart}
                <span className="italic text-lime-deep">{doors.doorA.titleEmphasis}</span>
              </h3>
              <p className="mt-4 text-sm sm:text-base text-ink-soft leading-[1.6]">
                {doors.doorA.body}
              </p>

              {/* Action Button */}
              <div className="mt-6">
                <Link
                  href={doors.doorA.href}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold border border-ink text-ink hover:bg-ink hover:text-bg active:scale-95 transition-all"
                  onClick={() => trackEvent({ name: "door_user_click" })}
                >
                  {doors.doorA.buttonLabel}
                </Link>
              </div>

              {/* Counter note */}
              <p className="mt-4 text-xs text-ink-faint">
                {doors.doorA.note}
              </p>
            </div>

            {/* Cropped Phone Concept rising from bottom */}
            <div className="absolute right-4 sm:right-8 -bottom-16 sm:-bottom-12 z-10 pointer-events-none transition-transform duration-300 group-hover:-translate-y-2 scale-75 sm:scale-[0.82] origin-bottom-right">
              <PhoneConcept screen="upload" />
            </div>
          </div>

          {/* DOOR B: FOR PRINT SHOPS (Forest Dark Panel) */}
          <div className="group relative min-h-[540px] sm:min-h-[580px] bg-forest rounded-3xl p-8 sm:p-10 flex flex-col justify-between overflow-hidden text-ink-on-forest transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
            <ConceptTag variant="forest" />

            {/* Top Text Content */}
            <div className="relative z-10 max-w-sm">
              <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-on-forest/60">
                {doors.doorB.label}
              </span>
              <h3 className="mt-3 font-display text-3xl sm:text-4xl text-ink-on-forest">
                {doors.doorB.titleStart}
                <span className="italic text-lime">{doors.doorB.titleEmphasis}</span>
              </h3>
              <p className="mt-4 text-sm sm:text-base text-ink-on-forest/80 leading-[1.6]">
                {doors.doorB.body}
              </p>

              {/* Action Button & Text Link */}
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link
                  href={doors.doorB.href}
                  className="px-5 py-3 rounded-full text-sm font-semibold bg-lime text-ink hover:brightness-95 active:scale-95 transition-all shadow-xs"
                  onClick={() => trackEvent({ name: "door_shop_click" })}
                >
                  {doors.doorB.buttonLabel}
                </Link>

                <a
                  href={doors.doorB.textLink.href}
                  className="text-sm font-semibold text-lime hover:underline"
                >
                  {doors.doorB.textLink.label}
                </a>
              </div>
            </div>

            {/* Cropped Desktop Concept rising from bottom */}
            <div className="absolute right-2 sm:right-6 -bottom-10 sm:-bottom-8 z-10 pointer-events-none transition-transform duration-300 group-hover:-translate-y-2 w-[85%] sm:w-[380px]">
              <DesktopConcept screen="queue" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
