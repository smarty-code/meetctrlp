"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { siteCopy } from "@/content/copy"
import { Hills } from "@/components/concepts/Hills"
import { ConceptTag } from "@/components/concepts/ConceptTag"
import { PhoneConcept } from "@/components/concepts/PhoneConcept"
import { DesktopConcept } from "@/components/concepts/DesktopConcept"
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"
import { trackEvent } from "@/lib/analytics"

export function HeroSection() {
  const { hero } = siteCopy
  const heroRef = useRef<HTMLElement>(null)
  const isReducedMotion = usePrefersReducedMotion()

  // Motion state for the 6s hero loop (PRD Section 5.1)
  const [animStep, setAnimStep] = useState<number>(0)

  useEffect(() => {
    if (isReducedMotion) {
      return
    }

    let isVisible = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting
      },
      { threshold: 0.1 }
    )

    if (heroRef.current) {
      observer.observe(heroRef.current)
    }

    // 6-second cyclic loop:
    // 0: initial, 1: button press, 2: order chip flies, 3: printing status
    const interval = setInterval(() => {
      if (!isVisible || document.hidden) return
      setAnimStep((prev) => (prev + 1) % 4)
    }, 1500)

    return () => {
      clearInterval(interval)
      observer.disconnect()
    }
  }, [isReducedMotion])

  const currentStep = isReducedMotion ? 3 : animStep

  return (
    <section
      id="hero"
      ref={heroRef}
      className="relative w-full bg-bg overflow-hidden"
      aria-label="Hero"
    >
      <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200/80 items-stretch">
        {/* Left Column: Typography & CTAs (Cols 1-6) */}
        <div className="lg:col-span-6 px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20 flex flex-col justify-center items-start">
          {/* Bracket Label */}
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
            {hero.bracket}
          </span>

          {/* H1 Headline */}
          <h1 className="mt-6 font-display text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.035em] text-ink font-normal">
            {hero.headlineStart}
            <span className="italic text-lime-deep block sm:inline">
              {hero.headlineEmphasis}
            </span>
          </h1>

          {/* Subhead */}
          <p className="mt-6 text-base sm:text-lg lg:text-[1.2rem] text-ink-soft leading-[1.55] max-w-[50ch]">
            {hero.subhead}
          </p>

          {/* CTA Row */}
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <Link
              href={hero.primaryCta.href}
              className="px-6 py-3.5 rounded-full font-semibold text-center bg-lime text-ink hover:brightness-95 active:scale-95 transition-all shadow-xs text-sm"
              onClick={() =>
                trackEvent({ name: "cta_explore_click", properties: { location: "hero" } })
              }
            >
              {hero.primaryCta.label}
            </Link>

            <Link
              href={hero.secondaryCta.href}
              className="px-6 py-3.5 rounded-full font-semibold text-center bg-transparent border border-ink text-ink hover:bg-ink hover:text-bg active:scale-95 transition-all text-sm"
              onClick={() =>
                trackEvent({ name: "cta_print_shops_click", properties: { location: "hero" } })
              }
            >
              {hero.secondaryCta.label}
            </Link>
          </div>

          {/* Microcopy */}
          <p className="mt-4 text-xs sm:text-sm text-ink-faint">
            {hero.microcopy}
          </p>
        </div>

        {/* Right Column: Composition Container (Cols 7-12) */}
        <div className="lg:col-span-6 px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex items-center justify-center relative overflow-hidden bg-surface-sunken/20">
          {/* Background Hills */}
          <Hills variant="bottom" />

          <div className="relative z-10 w-full max-w-[520px] h-[440px] sm:h-[520px] flex items-center justify-center">
            {/* Concept Tag */}
            <ConceptTag />

            {/* Desktop Concept in Background */}
            <div className="absolute top-2 right-0 sm:right-2 w-[85%] sm:w-[440px] lg:w-[460px]">
              <DesktopConcept
                screen="queue"
                newOrderIncoming={currentStep >= 2}
              />
            </div>

            {/* Phone Concept in Foreground with 3 deg counter-tilt */}
            <div className="absolute bottom-2 left-2 sm:left-4 z-10 -rotate-3 hover:rotate-0 transition-transform duration-300 scale-[0.78] sm:scale-85 origin-bottom-left">
              <PhoneConcept
                screen="review"
                isPressed={currentStep === 1}
              />
            </div>

            {/* Traveling Order Chip (Motion step 2) */}
            {!isReducedMotion && currentStep === 2 && (
              <div
                className="absolute z-30 px-2.5 py-1 rounded-full bg-lime text-ink font-bold text-[11px] shadow-md border border-lime-deep/30 pointer-events-none animate-in fade-in zoom-in duration-300"
                style={{
                  top: "40%",
                  left: "35%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                #CP10482 ↗
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
