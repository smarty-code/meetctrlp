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
      className="py-20 sm:py-28 bg-surface-sunken border-y border-line"
      aria-label="Trust and document control"
    >
      <div className="max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
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

          {/* Right Stacked List of Verified Rows (Cols 7-12) */}
          <div className="lg:col-span-7 divide-y divide-line">
            {verifiedRows.map((row) => (
              <div key={row.number} className="py-8 first:pt-0 last:pb-0 flex items-start gap-6">
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
      </div>
    </section>
  )
}
