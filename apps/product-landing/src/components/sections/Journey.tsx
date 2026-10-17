import { sectionIds } from "@/config/routes"
import { conceptCopy } from "@/content/concepts"
import { journeyCopy, journeySteps } from "@/content/steps"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { SectionHeader } from "@/components/sections/SectionHeader"
import {
  JourneyScene,
  type ResolvedStep,
} from "@/components/sections/JourneyScene"
import { resolveGated } from "@/lib/claims"
import { describe } from "@/lib/concepts"

/** 5.2 The journey in 5 steps. Claims are resolved here, on the server. */
export function Journey() {
  const steps: ResolvedStep[] = journeySteps.map((step, index) => ({
    ...step,
    detail: resolveGated(step.detail) ?? "",
    description: `${conceptCopy.tag.srCaption} ${describe(conceptCopy.a11y.journey[index] ?? "")}`,
  }))

  return (
    <Section id={sectionIds.journey} lazy={false}>
      <Container>
        <SectionHeader id={headingId(sectionIds.journey)} intro={journeyCopy} />
        <JourneyScene steps={steps} />
      </Container>
    </Section>
  )
}
