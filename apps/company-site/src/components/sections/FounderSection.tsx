import React from "react"
import Link from "next/link"
import { siteCopy } from "@/content/copy"
import { siteConfig } from "@/content/site-config"
import { FounderIllustration } from "@/components/concepts/FounderIllustration"

export function FounderSection() {
  const { founder } = siteCopy
  const founderName = siteConfig.contact.founderName

  return (
    <section
      id="founder"
      className="relative w-full bg-bg overflow-hidden"
      aria-label="Why we are building this"
    >
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200/80 items-stretch">
        {/* Left Column: Hand-drawn Illustration (Cols 1-5) */}
        <div className="lg:col-span-5 px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20 flex items-center justify-center bg-surface-sunken/20">
          <FounderIllustration />
        </div>

        {/* Right Column: Founder Note Content (Cols 7-12) */}
        <div className="lg:col-span-7 px-4 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20 flex flex-col items-start justify-center">
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
            {founder.eyebrow}
          </span>

          <h2 className="mt-4 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em] text-ink">
            {founder.h2Start}
            <span className="italic text-lime-deep block sm:inline">
              {founder.h2Emphasis}
            </span>
          </h2>

          <p className="mt-6 text-base sm:text-lg text-ink-soft leading-[1.6] max-w-[50ch]">
            {founder.body}
          </p>

          <p className="mt-8 font-display text-2xl sm:text-3xl text-ink leading-tight">
            {founder.closing}
          </p>

          {/* Signature */}
          <div className="mt-4 text-sm font-medium text-ink-faint">
            <span className="font-semibold text-ink">{founderName}</span>, {founder.signatureRole}
          </div>

          {/* Optional Flagged Journey Link */}
          {siteConfig.features.showJourney && (
            <div className="mt-6">
              <Link
                href={siteConfig.urls.journey}
                className="group text-sm font-semibold text-lime-deep hover:underline inline-flex items-center gap-1"
              >
                <span>Follow our journey</span>
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
