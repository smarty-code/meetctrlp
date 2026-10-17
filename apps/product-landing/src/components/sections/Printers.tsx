import { sectionIds } from "@/config/routes"
import { conceptCopy } from "@/content/concepts"
import { printersCopy } from "@/content/copy"
import { DesktopConcept } from "@/components/concepts/DesktopConcept"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { ConceptCaption, ConceptTag } from "@/components/ui/ConceptTag"
import { SectionHeader } from "@/components/sections/SectionHeader"
import { isVerified, resolveGatedList } from "@/lib/claims"
import { describe } from "@/lib/concepts"
import { stagger } from "@/lib/motion"

/** 5.6 Printer setup: removes the "will it work with my printer?" fear. */
export function Printers() {
  const headline = isVerified(printersCopy.headlineClaim)
    ? printersCopy.headline
    : printersCopy.headlineFallback
  const reassurance = resolveGatedList(printersCopy.reassurance)

  return (
    <Section id={sectionIds.printers}>
      <Container className="grid items-center gap-12 lg:grid-cols-12 lg:gap-6">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <SectionHeader
            id={headingId(sectionIds.printers)}
            intro={{ ...printersCopy, headline }}
          />
          {reassurance.length > 0 && (
            <ul className="flex flex-col gap-3">
              {reassurance.map((line) => (
                <li key={line.text} className="flex gap-3 text-body">
                  <span aria-hidden="true" className="text-lime-deep">
                    {conceptCopy.glyphs.check}
                  </span>
                  {line.resolved}
                </li>
              ))}
            </ul>
          )}
          <p className="text-small text-ink-faint">{printersCopy.note}</p>
        </div>
        <figure className="relative flex flex-col gap-8 rounded-xl bg-surface p-6 shadow-card sm:p-8 lg:col-span-7 lg:col-start-6">
          <ConceptCaption
            description={`${conceptCopy.a11y.printers} ${describe(conceptCopy.a11y.agent)}`}
          />
          <ConceptTag />
          <Diagram />
          <DesktopConcept screen="agent" variant="panel" figure={false} />
        </figure>
      </Container>
    </Section>
  )
}

/** CtrlP → shop computer → printers, joined by a dashed connector with moving dots. Vertical on mobile. */
function Diagram() {
  const { nodes } = printersCopy
  return (
    <ol
      aria-hidden="true"
      className="mt-8 flex flex-col items-stretch gap-8 sm:flex-row sm:items-start sm:gap-4"
    >
      {nodes.map((node, index) => (
        <li
          key={node.label}
          className="relative flex flex-1 flex-col items-center gap-2 text-center"
        >
          <span className="flex min-h-tap w-full items-center justify-center rounded-lg border border-line bg-bg px-4 py-3 text-small font-semibold">
            {node.label}
          </span>
          <span className="text-caption text-ink-faint">{node.caption}</span>
          {index < nodes.length - 1 && <Connector />}
        </li>
      ))}
    </ol>
  )
}

function Connector() {
  const dots = [0, 1, 2]
  return (
    <span className="absolute start-1/2 -bottom-8 h-8 border-s-2 border-dashed border-lime-deep sm:start-full sm:top-6 sm:bottom-auto sm:h-0 sm:w-4 sm:border-s-0 sm:border-t-2">
      {dots.map((dot) => (
        <span
          key={dot}
          style={stagger(dot)}
          className="travel-y absolute -start-1 size-1.5 rounded-pill bg-lime-deep sm:hidden"
        />
      ))}
      {dots.map((dot) => (
        <span
          key={`x-${dot}`}
          style={stagger(dot)}
          className="travel-x absolute -top-1 hidden size-1.5 rounded-pill bg-lime-deep sm:block"
        />
      ))}
    </span>
  )
}
