import { flags } from "@/config/flags"
import { sectionIds } from "@/config/routes"
import { conceptCopy } from "@/content/concepts"
import { plansCopy } from "@/content/copy"
import { Hills } from "@/components/concepts/Hills"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { RequestCallButton } from "@/components/ui/RequestCall"
import { WhatsAppButton } from "@/components/ui/TrackedLinks"
import { SectionHeader } from "@/components/sections/SectionHeader"
import { PricingTiers } from "@/components/sections/PricingTiers"
import { resolveGatedList } from "@/lib/claims"

/** 5.8 Plans: a custom-plan conversation. No price, plan name or tier table unless the flag is on. */
export function Plans() {
  const included = resolveGatedList(plansCopy.included)

  return (
    <Section id={sectionIds.plans} className="overflow-hidden">
      <Hills variant="panel" className="top-1/3" />
      <Container className="relative flex flex-col gap-12">
        <SectionHeader
          id={headingId(sectionIds.plans)}
          intro={plansCopy}
          align="center"
        />
        {flags.showPricing && <PricingTiers />}
        <div className="mx-auto grid w-full max-w-plans overflow-hidden rounded-xl bg-surface shadow-card md:grid-cols-2">
          <div className="flex flex-col gap-6 p-6 sm:p-10">
            <h3 className="text-h3 font-semibold">{plansCopy.cardTitle}</h3>
            <p className="text-body text-ink-soft">{plansCopy.cardText}</p>
            {included.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-eyebrow text-ink-faint uppercase">
                  {plansCopy.includedTitle}
                </p>
                <ul className="flex flex-col gap-2">
                  {included.map((item) => (
                    <li key={item.text} className="flex gap-3 text-body">
                      <span aria-hidden="true" className="text-lime-deep">
                        {conceptCopy.glyphs.check}
                      </span>
                      {item.resolved}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <p className="text-eyebrow text-ink-faint uppercase">
                {plansCopy.audienceTitle}
              </p>
              <ul className="flex flex-wrap gap-2">
                {plansCopy.audiences.map((audience) => (
                  <li
                    key={audience}
                    className="rounded-pill border border-line px-3 py-1.5 text-caption"
                  >
                    {audience}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-3 bg-surface-sunken p-6 sm:p-10">
            <WhatsAppButton location="plans" className="w-full" />
            <RequestCallButton location="plans" className="w-full" />
            <p className="text-center text-small text-ink-faint">
              {plansCopy.microcopy}
            </p>
          </div>
        </div>
      </Container>
    </Section>
  )
}
