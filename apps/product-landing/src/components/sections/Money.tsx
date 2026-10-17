import { Fragment } from "react"
import { sectionIds } from "@/config/routes"
import { conceptCopy } from "@/content/concepts"
import { moneyCopy } from "@/content/copy"
import { ownerInputs } from "@/content/ownerInputs"
import { sampleData } from "@/content/sampleData"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { SectionHeader } from "@/components/sections/SectionHeader"
import { LimeDot } from "@/components/ui/Typography"
import { isVerified } from "@/lib/claims"
import { fill, formatRupees } from "@/lib/format"
import { cn } from "@/lib/cn"
import type { LabelledLine } from "@/types/content"

/** 5.7 Money: you keep 100%. */
export function Money() {
  const commission = isVerified(moneyCopy.statClaim)
  const rows: LabelledLine[] = [
    ...moneyCopy.rows,
    ...(commission ? [moneyCopy.commissionRow] : []),
    ...(ownerInputs.settlementTiming
      ? [
          {
            label: moneyCopy.settlementLabel,
            text: ownerInputs.settlementTiming,
          },
        ]
      : []),
  ]
  const amount = formatRupees(sampleData.primaryOrder.total)

  return (
    <Section id={sectionIds.money} tone="surface">
      <Container className="grid items-start gap-12 lg:grid-cols-12 lg:gap-6">
        {commission && (
          <div className="flex flex-col gap-4 lg:col-span-6">
            <p className="font-display text-stat tabular">{moneyCopy.stat}</p>
            <p className="flex items-center gap-3 text-h3 font-semibold">
              <LimeDot className="size-3" />
              {moneyCopy.statCaption}
            </p>
          </div>
        )}
        <div
          className={cn(
            "flex flex-col gap-8",
            commission ? "lg:col-span-6" : "lg:col-span-8"
          )}
        >
          <SectionHeader id={headingId(sectionIds.money)} intro={moneyCopy} />
          <p className="max-w-prose text-body text-ink-soft">
            {moneyCopy.body}
          </p>
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li
                key={row.label}
                className="border-t border-line py-4 text-body last:border-b"
              >
                <strong className="font-semibold">{row.label}</strong>{" "}
                <span className="text-ink-soft">{row.text}</span>
              </li>
            ))}
          </ul>
          <figure className="flex flex-col gap-3">
            <figcaption className="text-caption text-ink-faint">
              {conceptCopy.tag.example}
            </figcaption>
            <ol
              aria-label={moneyCopy.flowLabel}
              className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center"
            >
              {moneyCopy.flow.map((step, index) => (
                <Fragment key={step}>
                  {index > 0 && (
                    <li
                      aria-hidden="true"
                      className="ps-4 text-ink-faint sm:ps-0"
                    >
                      <span className="inline-block rotate-90 sm:rotate-0">
                        {conceptCopy.glyphs.arrow}
                      </span>
                    </li>
                  )}
                  <li
                    className={cn(
                      "rounded-pill border px-3 py-1.5 text-caption tabular",
                      index === moneyCopy.flow.length - 1
                        ? "border-lime-soft bg-lime-soft"
                        : "border-line"
                    )}
                  >
                    {fill(step, { amount })}
                  </li>
                </Fragment>
              ))}
            </ol>
          </figure>
        </div>
      </Container>
    </Section>
  )
}
