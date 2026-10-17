import type { CSSProperties } from "react"
import type { Metadata } from "next"
import { pricingPage } from "@/content/pages"
import { PageShell } from "@/components/editorial/PageShell"
import { Breadcrumb } from "@/components/editorial/Breadcrumb"
import { HalftoneBackdrop } from "@/components/editorial/Backdrop"
import { TicketCard } from "@/components/editorial/TicketCard"
import { PricingActions } from "@/components/editorial/PricingActions"

export const metadata: Metadata = {
  title: pricingPage.meta.title,
  description: pricingPage.meta.description,
  alternates: { canonical: "/pricing" },
}

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties

/** /pricing: one custom plan on a perforated ticket over a dot-matrix band (Vestris pricing layout). */
export default function PricingPage() {
  const { headline, card, includedTitle, included } = pricingPage

  return (
    <PageShell>
      <section className="relative overflow-hidden" aria-labelledby="pricing-title">
        <HalftoneBackdrop className="top-24" />

        <div className="relative z-10 px-4 sm:px-6 pt-16 pb-6 text-center">
          <Breadcrumb current={pricingPage.breadcrumb} />
          <h1
            id="pricing-title"
            className="rise-in mt-6 font-display text-[clamp(2.75rem,7vw,5rem)] leading-[0.98] tracking-[-0.03em] text-ink"
            style={delay(100)}
          >
            <span className="block">{headline.line1}</span>
            <span className="block italic text-lime-deep">{headline.line2}</span>
          </h1>
        </div>

        <div className="relative z-10 px-4 sm:px-6 mt-10 md:mt-14 mb-24">
          <TicketCard widthClass="max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
              {/* Part A: consultation */}
              <div className="md:col-span-5 flex flex-col items-start">
                <h2 className="font-display text-4xl md:text-5xl leading-[1.02] tracking-[-0.02em] text-ink">
                  {card.title}
                </h2>
                <p className="mt-4 mb-8 text-sm md:text-base text-ink-soft leading-relaxed">{card.body}</p>
                <PricingActions />
              </div>

              {/* Part B: what's included */}
              <div className="md:col-span-7 border-t md:border-t-0 md:border-l border-line pt-8 md:pt-0 md:pl-10">
                <p className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">{includedTitle}</p>
                <ul className="mt-6 space-y-4">
                  {included.map((item, index) => (
                    <li
                      key={item}
                      className="rise-in flex items-start gap-3 text-sm md:text-base text-ink-soft leading-snug"
                      style={delay(400 + index * 50)}
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[11px] text-lime-deep"
                      >
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TicketCard>
        </div>
      </section>
    </PageShell>
  )
}
