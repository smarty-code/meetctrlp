import React from "react"
import { siteCopy } from "@/content/copy"
import { getVerifiedTrustRows } from "@/content/claims"

export function TrustSection() {
  const { trust } = siteCopy
  const verifiedRows = getVerifiedTrustRows()

  // PRD Rule: If fewer than two rows are verified, hide the entire section.
  if (verifiedRows.length < 2) {
    return null
  }

  return (
    <section
      id="trust"
      className="relative w-full bg-surface-sunken/40"
      aria-label="Trust and document control"
    >
      <div className="w-full px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        {/* Left Block (Cols 1-5) */}
        <div className="lg:col-span-5 flex flex-col items-start">
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
            {trust.eyebrow}
          </span>
          <h2 className="mt-4 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em] text-ink">
            {trust.h2Start}
            <span className="italic text-lime-deep block sm:inline">
              {trust.h2Emphasis}
            </span>
          </h2>
        </div>

        {/* Right Stacked List of Verified Rows (Cols 6-12) */}
        <div className="lg:col-span-7 divide-y divide-neutral-200/80 border-y border-neutral-200/80">
          {verifiedRows.map((row) => (
            <div key={row.number} className="py-6 sm:py-8 flex items-start gap-4 sm:gap-6">
              <span className="font-mono text-xs font-bold text-ink-faint w-8 shrink-0 pt-1">
                {row.number}
              </span>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-ink">
                  {row.title}
                </h3>
                <p className="mt-2 text-sm sm:text-base text-ink-soft leading-[1.6]">
                  {row.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
