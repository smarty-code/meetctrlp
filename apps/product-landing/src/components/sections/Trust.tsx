import { routes, sectionIds } from "@/config/routes"
import { conceptCopy } from "@/content/concepts"
import { trustCopy } from "@/content/copy"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { LinkArrow } from "@/components/ui/Button"
import { SectionHeader } from "@/components/sections/SectionHeader"
import { resolveClaim, resolveGated } from "@/lib/claims"
import { formatStep } from "@/lib/format"

/** 5.9 Trust and privacy: calm statement rows, no icons. */
export function Trust() {
  const promises = trustCopy.promises.flatMap((promise) => {
    const text = resolveClaim(promise.claim)
    return text ? [{ title: promise.title, text }] : []
  })
  const access = resolveGated(trustCopy.access)

  return (
    <Section id={sectionIds.trust} tone="sunken">
      <Container className="grid gap-12 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-8">
        <SectionHeader
          id={headingId(sectionIds.trust)}
          intro={trustCopy}
          className="lg:col-span-5"
        />
        <div className="order-3 flex flex-col gap-4 lg:order-none lg:col-span-5 lg:row-start-2">
          <p className="max-w-prose text-body-l">
            <strong className="font-semibold">{trustCopy.control.label}</strong>{" "}
            <span className="text-ink-soft">{trustCopy.control.text}</span>
          </p>
          {access && <p className="text-body text-ink-soft">{access}</p>}
          <a
            href={routes.privacy}
            className="group inline-flex min-h-tap items-center gap-2 text-small text-lime-deep"
          >
            {trustCopy.privacyLink}
            <LinkArrow glyph={conceptCopy.glyphs.arrow} />
          </a>
        </div>
        <ol className="order-2 flex flex-col lg:order-none lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          {promises.map((promise, index) => (
            <li
              key={promise.title}
              className="flex gap-6 border-t border-line py-10 last:border-b"
            >
              <span className="text-caption text-ink-faint">
                {formatStep(index + 1)}
              </span>
              <div className="flex flex-col gap-3">
                <h3 className="font-display text-display-m">{promise.title}</h3>
                <p className="text-body text-ink-soft">{promise.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  )
}
