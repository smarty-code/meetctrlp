import { sectionIds } from "@/config/routes"
import { conceptCopy } from "@/content/concepts"
import { ctas, heroCopy } from "@/content/copy"
import { Hills } from "@/components/concepts/Hills"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { ButtonLink } from "@/components/ui/Button"
import { WhatsAppButton } from "@/components/ui/TrackedLinks"
import { BracketLabel } from "@/components/ui/Typography"
import { stagger } from "@/lib/motion"
import { HeroScene } from "@/components/sections/HeroScene"
import { resolveGatedList } from "@/lib/claims"

/** 5.1 Hero. The H1 is server-rendered text so it is the LCP element. */
export function Hero() {
  const microcopy = resolveGatedList(heroCopy.microcopy)
  const { headline } = heroCopy

  return (
    <Section
      id={sectionIds.hero}
      spacing="none"
      lazy={false}
      className="overflow-hidden"
    >
      <Hills variant="bottom" className="top-auto h-2/5" />
      <Container className="relative grid min-h-hero-min items-center gap-12 pt-28 pb-16 lg:grid-cols-12 lg:gap-6 lg:pt-32">
        <div className="flex flex-col items-start lg:col-span-6">
          <BracketLabel className="rise text-ink-soft">
            {heroCopy.bracket}
          </BracketLabel>
          <h1
            id={headingId(sectionIds.hero)}
            className="mt-6 max-w-headline font-display text-display-xl text-balance"
          >
            <span className="rise block" style={stagger(1)}>
              {headline.lead}
            </span>
            <em className="rise block text-lime-deep italic" style={stagger(2)}>
              {headline.emphasis}
            </em>
          </h1>
          <p
            className="rise mt-6 max-w-subhead text-body-l text-ink-soft"
            style={stagger(3)}
          >
            {heroCopy.subhead}
          </p>
          <div
            className="rise mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
            style={stagger(4)}
          >
            <WhatsAppButton location="hero" block />
            <ButtonLink
              href={`#${sectionIds.journey}`}
              variant="secondary"
              block
            >
              {ctas.seeCustomers}
            </ButtonLink>
          </div>
          {microcopy.length > 0 && (
            <p
              className="rise mt-4 text-small text-ink-faint"
              style={stagger(5)}
            >
              {microcopy
                .map((item) => item.resolved)
                .join(` ${conceptCopy.glyphs.separator} `)}
            </p>
          )}
        </div>
        <div className="rise lg:col-span-6" style={stagger(6)}>
          <HeroScene />
        </div>
      </Container>
    </Section>
  )
}
