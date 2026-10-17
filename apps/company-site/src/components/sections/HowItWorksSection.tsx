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
  const desktopTrackRef = useRef<HTMLDivElement>(null)
  const activeStepRef = useRef(0)

  useEffect(() => {
    const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches

    const syncActiveStep = () => {
      if (!isDesktop()) return

      const track = desktopTrackRef.current
      const steps = stepElementsRef.current.filter(
        (el): el is HTMLDivElement => el !== null
      )
      if (!track || steps.length === 0) return

      const trackRect = track.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const focusLine = viewportHeight * 0.5

      // Step track not engaged yet — keep the first showcase frame
      if (trackRect.top > focusLine) {
        if (activeStepRef.current !== 0) {
          activeStepRef.current = 0
          setActiveStep(0)
        }
        return
      }

      // Past the step track — keep the final frame
      if (trackRect.bottom < focusLine) {
        const lastIndex = steps.length - 1
        if (activeStepRef.current !== lastIndex) {
          activeStepRef.current = lastIndex
          setActiveStep(lastIndex)
        }
        return
      }

      let closestIndex = 0
      let closestDistance = Infinity

      steps.forEach((el, index) => {
        const rect = el.getBoundingClientRect()
        const elementCenter = rect.top + rect.height / 2
        const distance = Math.abs(elementCenter - focusLine)

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      // Don't advance past step 01 until its copy has scrolled into the focus band
      const stepOneTop = steps[0].getBoundingClientRect().top
      if (stepOneTop > focusLine) {
        closestIndex = 0
      }

      if (closestIndex !== activeStepRef.current) {
        activeStepRef.current = closestIndex
        setActiveStep(closestIndex)
        trackEvent({
          name: "how_it_works_step_view",
          properties: { step: (closestIndex + 1) as 1 | 2 | 3 },
        })
      }
    }

    syncActiveStep()
    window.addEventListener("scroll", syncActiveStep, { passive: true })
    window.addEventListener("resize", syncActiveStep)
    return () => {
      window.removeEventListener("scroll", syncActiveStep)
      window.removeEventListener("resize", syncActiveStep)
    }
  }, [])

  return (
    <section
      id="how-it-works"
      className="relative w-full bg-bg divide-y divide-neutral-200/80"
      aria-label="How CtrlP works"
    >
      {/* Section Header */}
      <div className="px-6 sm:px-8 lg:px-12 py-12 sm:py-16">
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
      </div>

      {/* DESKTOP LAYOUT (>= 1024px): Two Columns with Sticky Concept Panel */}
      <div
        ref={desktopTrackRef}
        className="hidden lg:grid grid-cols-12 gap-12 px-6 sm:px-8 lg:px-12 py-16 items-stretch relative"
      >
        {/* Left Column: Numbered Steps (Cols 1-5) */}
        <div className="col-span-5 relative pl-8 py-4 space-y-36">
          {/* Vertical Progress Line */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-neutral-200/80 rounded-full">
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
        <div className="col-span-7 relative self-stretch">
          <div className="sticky top-[12vh] h-[76vh] max-h-[680px] self-start w-full rounded-3xl bg-surface-sunken border border-neutral-200/80 overflow-hidden p-8 flex items-center justify-center shadow-card">
            <ConceptTag />
            <Hills variant="panel" />

            {/* Crossfading Screens */}
            <div className="relative z-10 w-full h-full">
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  activeStep === 0 ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                aria-hidden={activeStep !== 0}
              >
                <div className="scale-90">
                  <PhoneConcept screen="upload" />
                </div>
              </div>

              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  activeStep === 1 ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                aria-hidden={activeStep !== 1}
              >
                <div className="w-full max-w-[480px]">
                  <DesktopConcept screen="job" isAccepted={true} />
                </div>
              </div>

              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  activeStep === 2 ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                aria-hidden={activeStep !== 2}
              >
                <div className="scale-90">
                  <PhoneConcept screen="track" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE & TABLET LAYOUT (< 1024px): Stacked Vertical Blocks */}
      <div className="lg:hidden px-4 sm:px-6 py-12 space-y-16">
        {howItWorks.steps.map((step, idx) => (
          <div key={step.number} className="flex flex-col gap-6">
            {/* Concept Card */}
            <div className="relative w-full aspect-[4/5] max-h-[440px] rounded-2xl bg-surface-sunken border border-neutral-200/80 overflow-hidden p-6 flex items-center justify-center shadow-xs">
              <ConceptTag />
              <Hills variant="panel" />

              <div className="relative z-10 scale-[0.66] xs:scale-[0.7] sm:scale-[0.8] origin-center">
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
    </section>
  )
}
