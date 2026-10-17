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
      className="relative w-full bg-bg divide-y divide-neutral-200/80"
      aria-label="Two doors: user and print shop entrances"
    >
      {/* Section Heading */}
      <div className="px-6 sm:px-8 lg:px-12 py-12 sm:py-16">
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
      </div>

      {/* Two Doors Matrix: 2-column grid on desktop with internal vertical divider, stacking on mobile with horizontal divider */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200/80 items-stretch">
        {/* DOOR A: FOR PEOPLE PRINTING */}
        <div className="group relative min-h-[480px] lg:min-h-[540px] bg-surface p-6 sm:p-8 lg:p-10 pb-8 sm:pb-8 lg:pb-10 flex flex-col justify-between overflow-hidden">
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
                className="group inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold border border-ink text-ink hover:bg-ink hover:text-bg active:scale-95 transition-all"
                onClick={() => trackEvent({ name: "door_user_click" })}
              >
                <span>See how printing works</span>
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>

            {/* Counter note */}
            <p className="mt-4 text-xs text-ink-faint">
              {doors.doorA.note}
            </p>
          </div>

          {/* Visual Stage: Phone Concept fully visible with exact container dimensions */}
          <div className="relative z-10 mt-6 sm:mt-8 flex justify-center items-end w-full pointer-events-none">
            <div className="relative w-[174px] h-[354px] sm:w-[182px] sm:h-[370px] lg:w-[190px] lg:h-[388px] shrink-0 transition-transform duration-300 group-hover:-translate-y-1">
              <div className="w-[280px] h-[570px] origin-top-left scale-[0.62] sm:scale-[0.65] lg:scale-[0.68]">
                <PhoneConcept screen="upload" />
              </div>
            </div>
          </div>
        </div>

        {/* DOOR B: FOR PRINT SHOPS (Forest Dark Panel) */}
        <div className="group relative min-h-[480px] lg:min-h-[540px] bg-forest p-6 sm:p-8 lg:p-10 pb-8 sm:pb-8 lg:pb-10 flex flex-col justify-between overflow-hidden text-ink-on-forest">
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
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-lime hover:underline"
              >
                <span>Talk to us</span>
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
                  →
                </span>
              </a>
            </div>
          </div>

          {/* Visual Stage: Desktop Concept card fully visible within forest canvas */}
          <div className="relative z-10 mt-6 sm:mt-8 flex justify-center items-end w-full pointer-events-none">
            <div className="transition-transform duration-300 group-hover:-translate-y-1 w-full max-w-[320px] sm:max-w-[380px] lg:max-w-[420px]">
              <DesktopConcept screen="queue" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
