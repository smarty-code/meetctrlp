"use client"

import React, { useState, useEffect, useRef } from "react"
import { siteCopy } from "@/content/copy"
import { ConceptTag } from "@/components/concepts/ConceptTag"

export function ProblemSection() {
  const { problem, conceptData } = siteCopy
  const [showClean, setShowClean] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Trigger transition after brief delay when in view
          setTimeout(() => setShowClean(true), 600)
        }
      },
      { threshold: 0.3 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="problem"
      ref={sectionRef}
      className="py-20 sm:py-28 lg:py-36 bg-bg overflow-hidden"
      aria-label="Problem to solution"
    >
      <div className="max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Text Block (Cols 1-5) */}
          <div className="lg:col-span-5 flex flex-col items-start">
            <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
              {problem.eyebrow}
            </span>

            <h2 className="mt-4 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em] text-ink">
              {problem.h2Start}
              <span className="italic text-lime-deep block sm:inline">
                {problem.h2Emphasis}
              </span>
            </h2>

            <p className="mt-6 text-base sm:text-lg text-ink-soft leading-[1.6]">
              {problem.body}
            </p>

            {/* Interactive Toggle Pill */}
            <div className="mt-6 flex items-center gap-2 p-1 rounded-full bg-surface-sunken border border-line text-xs font-semibold text-ink-soft">
              <button
                type="button"
                onClick={() => setShowClean(false)}
                className={`px-3 py-1 rounded-full transition-all ${
                  !showClean ? "bg-surface text-ink shadow-xs" : "hover:text-ink"
                }`}
              >
                Today&apos;s Messages
              </button>
              <button
                type="button"
                onClick={() => setShowClean(true)}
                className={`px-3 py-1 rounded-full transition-all ${
                  showClean ? "bg-lime text-ink shadow-xs" : "hover:text-ink"
                }`}
              >
                With CtrlP
              </button>
            </div>
          </div>

          {/* Right Transition Visual (Cols 7-12) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="relative w-full h-[400px] sm:h-[480px] bg-surface-sunken rounded-3xl p-6 sm:p-8 flex items-center justify-center overflow-hidden">
              <ConceptTag />

              {/* State 1: Messy chat bubbles & scattered files */}
              <div
                className={`absolute inset-0 p-6 sm:p-10 flex flex-col justify-around transition-all duration-500 ${
                  showClean
                    ? "opacity-0 scale-90 pointer-events-none"
                    : "opacity-100 scale-100"
                }`}
              >
                <div className="flex flex-col gap-3 max-w-[340px]">
                  <div className="bg-surface p-3 rounded-2xl rounded-tl-xs border border-line shadow-xs -rotate-2 max-w-[240px]">
                    <p className="text-xs sm:text-sm text-ink">
                      {problem.messyState.bubbles[0]}
                    </p>
                  </div>

                  <div className="self-end bg-surface-sunken p-2.5 rounded-2xl rounded-tr-xs border border-line shadow-xs rotate-1 max-w-[200px]">
                    <p className="text-xs sm:text-sm text-ink-soft">
                      {problem.messyState.bubbles[1]}
                    </p>
                  </div>

                  <div className="bg-surface p-3 rounded-2xl rounded-tl-xs border border-line shadow-xs rotate-3 max-w-[260px]">
                    <p className="text-xs sm:text-sm text-ink">
                      {problem.messyState.bubbles[2]}
                    </p>
                  </div>

                  <div className="self-end bg-surface p-2.5 rounded-2xl rounded-tr-xs border border-line shadow-xs -rotate-1 max-w-[190px]">
                    <p className="text-xs sm:text-sm text-ink-faint">
                      {problem.messyState.bubbles[3]}
                    </p>
                  </div>
                </div>

                {/* Loose file chips */}
                <div className="flex items-center gap-3 pt-4">
                  <div className="px-3 py-1.5 rounded-lg bg-surface border border-line text-xs font-semibold text-ink-soft shadow-xs rotate-2 flex items-center gap-1.5">
                    <span>📄</span>
                    <span>{problem.messyState.files[0]}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-surface border border-line text-xs font-semibold text-ink-soft shadow-xs -rotate-3 flex items-center gap-1.5">
                    <span>📄</span>
                    <span>{problem.messyState.files[1]}</span>
                  </div>
                </div>
              </div>

              {/* State 2: Clean Structured Order Card */}
              <div
                className={`relative z-10 w-full max-w-[380px] bg-surface rounded-2xl p-5 border border-line shadow-card transition-all duration-500 ${
                  showClean
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-95 pointer-events-none"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-line">
                  <div>
                    <span className="text-[10px] font-bold text-ink-faint uppercase block tracking-wider">
                      Structured Order
                    </span>
                    <span className="text-sm font-bold text-ink">
                      Order {problem.cleanState.orderId}
                    </span>
                  </div>
                  <span className="text-xs font-bold bg-chip-paid-bg text-chip-paid-fg px-2.5 py-1 rounded-full border border-chip-paid-fg/20">
                    {problem.cleanState.badge}
                  </span>
                </div>

                <div className="mt-3.5 space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-surface-sunken border border-line flex justify-between items-center">
                    <div>
                      <p className="font-bold text-ink">{conceptData.order1.doc1.name}</p>
                      <p className="text-[11px] text-ink-soft">3 pages · Colour · 1 copy · A4</p>
                    </div>
                    <span className="font-bold text-ink">{conceptData.order1.doc1.price}</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-surface-sunken border border-line flex justify-between items-center">
                    <div>
                      <p className="font-bold text-ink">{conceptData.order1.doc2.name}</p>
                      <p className="text-[11px] text-ink-soft">4 pages · B&W · 2 copies · A4</p>
                    </div>
                    <span className="font-bold text-ink">{conceptData.order1.doc2.price}</span>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-line flex justify-between items-center text-sm font-bold text-ink">
                  <span>Total Amount</span>
                  <span className="text-base font-extrabold">{problem.cleanState.total}</span>
                </div>
              </div>
            </div>

            {/* Caption */}
            <p className="mt-3 text-xs text-ink-faint text-center">
              {problem.caption}
            </p>
          </div>
        </div>

        {/* Closing Line below the band */}
        <div className="mt-20 sm:mt-28 text-center max-w-2xl mx-auto">
          <p className="font-display text-[clamp(1.75rem,3.2vw,2.75rem)] text-ink leading-[1.08] tracking-[-0.02em]">
            {problem.closingStart}
            <span className="italic text-lime-deep">{problem.closingEmphasis}</span>
          </p>
        </div>
      </div>
    </section>
  )
}
