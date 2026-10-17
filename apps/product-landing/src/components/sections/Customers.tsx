import { sectionIds } from "@/config/routes"
import { conceptCopy } from "@/content/concepts"
import { customersCopy } from "@/content/copy"
import { Hills } from "@/components/concepts/Hills"
import { PhoneConcept } from "@/components/concepts/PhoneConcept"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { ConceptTag } from "@/components/ui/ConceptTag"
import { CustomerAppLink } from "@/components/ui/TrackedLinks"
import { LimeDot } from "@/components/ui/Typography"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeader } from "@/components/sections/SectionHeader"
import { resolveGatedList } from "@/lib/claims"
import { describe } from "@/lib/concepts"
import { stagger } from "@/lib/motion"

/** 5.3 For customers: a compact band. */
export function Customers() {
  const points = resolveGatedList(customersCopy.points)

  return (
    <Section id={sectionIds.customers} tone="sunken" spacing="compact">
      <Container className="grid items-center gap-12 lg:grid-cols-12 lg:gap-6">
        <Reveal className="flex flex-col gap-6 lg:col-span-6">
          <SectionHeader
            id={headingId(sectionIds.customers)}
            intro={customersCopy}
          />
          <p className="max-w-prose text-body text-ink-soft" style={stagger(1)}>
            {customersCopy.body}
          </p>
          <ul className="flex flex-col gap-3" style={stagger(2)}>
            {points.map((point) => (
              <li
                key={point.text}
                className="flex items-center gap-3 text-body"
              >
                <LimeDot />
                {point.resolved}
              </li>
            ))}
          </ul>
          <p className="text-small text-ink-faint" style={stagger(3)}>
            {customersCopy.note}
          </p>
          <div style={stagger(4)}>
            <CustomerAppLink location="customers" variant="secondary">
              {customersCopy.button}
            </CustomerAppLink>
          </div>
        </Reveal>
        <div className="relative flex h-panel-sm items-end justify-center overflow-hidden rounded-xl bg-bg lg:col-span-6 lg:h-panel">
          <Hills variant="panel" />
          <ConceptTag />
          {/* TODO(owner): swap for a real app.meetctrlp.in screenshot with a "Live app" tag when supplied (PRD 4.9). */}
          <PhoneConcept
            screen="track"
            description={describe(conceptCopy.a11y.customers)}
            className="relative w-3/5 max-w-phone-sm translate-y-1/4 sm:w-1/2"
          />
        </div>
      </Container>
    </Section>
  )
}
