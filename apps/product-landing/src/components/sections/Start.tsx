import { sectionIds } from "@/config/routes"
import { startCopy } from "@/content/copy"
import { Hills } from "@/components/concepts/Hills"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { RequestCallButton } from "@/components/ui/RequestCall"
import { Reveal } from "@/components/ui/Reveal"
import { WhatsAppButton } from "@/components/ui/TrackedLinks"
import { SectionHeader } from "@/components/sections/SectionHeader"
import { resolveGated } from "@/lib/claims"
import { formatStep } from "@/lib/format"
import { stagger } from "@/lib/motion"

/** 5.10 How to start: three steps, each with a painted thumbnail. */
export function Start() {
  return (
    <Section id={sectionIds.start}>
      <Container className="flex flex-col gap-12">
        <SectionHeader
          id={headingId(sectionIds.start)}
          intro={startCopy}
          align="center"
        />
        <Reveal
          as="ol"
          className="relative grid gap-12 md:grid-cols-3 md:gap-6"
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-16 top-1/6 hidden border-t border-line md:block"
          />
          {startCopy.steps.map((step, index) => (
            <li
              key={step.title}
              style={stagger(index)}
              className="relative flex flex-col gap-4"
            >
              <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-sunken md:aspect-thumb">
                <Hills variant="thumb" seed={index} />
              </div>
              <span className="font-display text-step-number text-ink-faint">
                {formatStep(index + 1)}
              </span>
              <h3 className="text-h3 font-semibold">{step.title}</h3>
              <p className="text-body text-ink-soft">
                {resolveGated(step.text)}
              </p>
            </li>
          ))}
        </Reveal>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <WhatsAppButton location="start" block />
          <RequestCallButton location="start" block />
        </div>
      </Container>
    </Section>
  )
}
