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
      className="py-20 sm:py-28 lg:py-36 bg-bg overflow-hidden"
      aria-label="Why we are building this"
    >
      <div className="max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Hand-drawn Illustration (Cols 1-5) */}
          <div className="lg:col-span-5 flex justify-center lg:justify-start">
            <FounderIllustration />
          </div>

          {/* Right Column: Founder Note Content (Cols 7-12) */}
          <div className="lg:col-span-7 flex flex-col items-start max-w-xl">
            <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
              {founder.eyebrow}
            </span>

            <h2 className="mt-4 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em] text-ink">
              {founder.h2Start}
              <span className="italic text-lime-deep block sm:inline">
                {founder.h2Emphasis}
              </span>
            </h2>

            <p className="mt-6 text-base sm:text-lg text-ink-soft leading-[1.6] max-w-[52ch]">
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
                  className="text-sm font-semibold text-lime-deep hover:underline inline-flex items-center gap-1"
                >
                  {founder.journeyLinkText}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
