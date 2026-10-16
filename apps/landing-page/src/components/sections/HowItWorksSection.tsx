"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { siteCopy } from "@/content/copy"
import { Hills } from "@/components/concepts/Hills"
import { ConceptTag } from "@/components/concepts/ConceptTag"
import { PhoneConcept } from "@/components/concepts/PhoneConcept"
import { DesktopConcept } from "@/components/concepts/DesktopConcept"
import { trackEvent } from "@/lib/analytics"

export function HowItWorksSection() {
  const { howItWorks } = siteCopy
  const [activeStep, setActiveStep] = useState<number>(0)
  const stepElementsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const handleScroll = () => {
      const viewportCenter = window.innerHeight / 2

      let closestIndex = 0
      let closestDistance = Infinity

      stepElementsRef.current.forEach((el, index) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const elementCenter = rect.top + rect.height / 2
        const distance = Math.abs(elementCenter - viewportCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      if (closestIndex !== activeStep) {
        setActiveStep(closestIndex)
        trackEvent({
          name: "how_it_works_step_view",
          properties: { step: (closestIndex + 1) as 1 | 2 | 3 },
        })
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [activeStep])

  return (
    <section
      id="how-it-works"
      className="py-20 sm:py-28 lg:py-36 bg-bg relative"
      aria-label="How CtrlP works"
    >
      <div className="max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="max-w-2xl">
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
            {howItWorks.eyebrow}
          </span>
          <h2 className="mt-4 font-display text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] tracking-[-0.025em] text-ink">
            {howItWorks.h2Start}
            <span className="italic text-lime-deep">{howItWorks.h2Emphasis}</span>
            {howItWorks.h2End}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-ink-soft leading-[1.6]">
            {howItWorks.intro}
          </p>
        </div>

        {/* DESKTOP LAYOUT (>= 1024px): Two Columns with Sticky Concept Panel */}
        <div className="hidden lg:grid grid-cols-12 gap-12 mt-16 relative">
          {/* Left Column: Numbered Steps (Cols 1-5) */}
          <div className="col-span-5 relative pl-8 py-8 space-y-36">
            {/* Vertical Progress Line */}
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-line rounded-full">
              <div
                className="w-full bg-lime transition-all duration-300 rounded-full"
                style={{
                  height: `${((activeStep + 1) / howItWorks.steps.length) * 100}%`,
                }}
              />
            </div>

            {howItWorks.steps.map((step, idx) => (
              <div
                key={step.number}
                ref={(el) => {
                  stepElementsRef.current[idx] = el
                }}
                className={`transition-opacity duration-300 ${
                  activeStep === idx ? "opacity-100" : "opacity-35"
                }`}
              >
                <span className="font-display text-4xl text-ink-faint block">
                  {step.number}
                </span>
                <h3 className="mt-3 text-2xl font-bold text-ink">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-base font-semibold text-ink">
                  {step.line}
                </p>
                <p className="mt-2 text-sm text-ink-soft leading-[1.6]">
                  {step.detail}
                </p>
              </div>
            ))}

            {/* Closing Links */}
            <div className="pt-8 flex flex-col gap-3 text-sm font-semibold text-lime-deep">
              {howItWorks.links.map((link) => {
                const textWithoutArrow = link.label.replace(" →", "")
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group inline-flex items-center gap-1.5 hover:underline w-fit"
                  >
                    <span>{textWithoutArrow}</span>
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
                      →
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Right Column: Sticky Concept Visual (Cols 7-12) */}
          <div className="col-span-7 relative">
            <div className="sticky top-[12vh] h-[76vh] max-h-[680px] rounded-3xl bg-surface-sunken border border-line overflow-hidden p-8 flex items-center justify-center shadow-card">
              <ConceptTag />
              <Hills variant="panel" />

              {/* Crossfading Screens */}
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                {activeStep === 0 && (
                  <div className="animate-in fade-in duration-300 scale-90">
                    <PhoneConcept screen="upload" />
                  </div>
                )}

                {activeStep === 1 && (
                  <div className="animate-in fade-in duration-300 w-full max-w-[480px]">
                    <DesktopConcept screen="job" isAccepted={true} />
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="animate-in fade-in duration-300 scale-90">
                    <PhoneConcept screen="track" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE & TABLET LAYOUT (< 1024px): Stacked Vertical Blocks */}
        <div className="lg:hidden mt-12 space-y-16">
          {howItWorks.steps.map((step, idx) => (
            <div key={step.number} className="flex flex-col gap-6">
              {/* Concept Card */}
              <div className="relative w-full aspect-[4/5] max-h-[440px] rounded-2xl bg-surface-sunken border border-line overflow-hidden p-6 flex items-center justify-center shadow-xs">
                <ConceptTag />
                <Hills variant="panel" />

                <div className="relative z-10 scale-[0.78] sm:scale-85">
                  {idx === 0 && <PhoneConcept screen="upload" />}
                  {idx === 1 && <DesktopConcept screen="job" isAccepted={true} className="max-w-[340px]" />}
                  {idx === 2 && <PhoneConcept screen="track" />}
                </div>
              </div>

              {/* Step Copy */}
              <div>
                <span className="font-display text-3xl text-ink-faint">
                  {step.number}
                </span>
                <h3 className="mt-2 text-xl font-bold text-ink">
                  {step.title}
                </h3>
                <p className="mt-1 font-semibold text-ink text-sm sm:text-base">
                  {step.line}
                </p>
                <p className="mt-2 text-sm text-ink-soft leading-[1.6]">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}

          {/* Mobile Closing Links */}
          <div className="pt-4 flex flex-col gap-2.5 text-sm font-semibold text-lime-deep">
            {howItWorks.links.map((link) => {
              const textWithoutArrow = link.label.replace(" →", "")
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group inline-flex items-center gap-1.5 hover:underline w-fit"
                >
                  <span>{textWithoutArrow}</span>
                  <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
                    →
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
