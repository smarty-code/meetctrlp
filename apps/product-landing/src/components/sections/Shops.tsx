import { sectionIds } from "@/config/routes"
import { conceptCopy } from "@/content/concepts"
import { shopsCopy } from "@/content/copy"
import { bentoTiles, minBentoTiles, type TileSize } from "@/content/tiles"
import { DesktopConcept } from "@/components/concepts/DesktopConcept"
import { Hills } from "@/components/concepts/Hills"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { ConceptTag } from "@/components/ui/ConceptTag"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeader } from "@/components/sections/SectionHeader"
import { TilePlayback } from "@/components/sections/TilePlayback"
import { resolveGatedList } from "@/lib/claims"
import { formatStep } from "@/lib/format"
import { stagger } from "@/lib/motion"
import { cn } from "@/lib/cn"

/** Footprint on the 6-column desktop grid and the 2-column tablet grid (PRD 5.5). */
const tileSpan: Record<TileSize, string> = {
  large: "md:col-span-2 lg:col-span-3 lg:row-span-2",
  wide: "lg:col-span-3",
  small: "lg:col-span-2",
  strip: "md:col-span-2 lg:col-span-6",
}

/** 5.5 What you get as a shop: the only bento on the page. */
export function Shops() {
  const tiles = resolveGatedList(
    bentoTiles.map((tile) => ({ ...tile.line, tile }))
  )

  return (
    <Section id={sectionIds.shops}>
      <Container className="flex flex-col gap-12">
        <SectionHeader id={headingId(sectionIds.shops)} intro={shopsCopy} />
        <div className="relative overflow-hidden rounded-xl bg-surface-sunken p-4 sm:p-8">
          <Hills variant="panel" />
          <ConceptTag className="end-6 top-6 sm:end-10 sm:top-10" />
          <p className="relative mb-4 text-caption text-ink-soft sm:mb-6">
            {conceptCopy.tag.bento}
          </p>
          {tiles.length >= minBentoTiles ? (
            <Reveal
              as="ul"
              className="relative grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6"
            >
              {tiles.map(({ tile, resolved }, index) => (
                <li
                  key={tile.id}
                  style={stagger(index)}
                  className={cn(
                    "flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-card",
                    tileSpan[tile.size]
                  )}
                >
                  <div>
                    <h3 className="text-h3 font-semibold">{tile.title}</h3>
                    <p className="mt-2 text-body text-ink-soft">{resolved}</p>
                  </div>
                  <div
                    className={cn(
                      "mt-auto max-h-bento-crop overflow-hidden fade-bottom md:max-h-none md:mask-none"
                    )}
                  >
                    {tile.visual === "job" ? (
                      <TilePlayback />
                    ) : (
                      <DesktopConcept
                        screen={tile.visual}
                        variant={tile.visual === "queue" ? "window" : "panel"}
                        figure={false}
                      />
                    )}
                  </div>
                </li>
              ))}
            </Reveal>
          ) : (
            <ol className="relative flex flex-col gap-6 rounded-lg bg-surface p-6">
              {tiles.map(({ tile, resolved }, index) => (
                <li key={tile.id} className="flex gap-4">
                  <span className="font-display text-step-number text-ink-faint">
                    {formatStep(index + 1)}
                  </span>
                  <div>
                    <h3 className="text-h3 font-semibold">{tile.title}</h3>
                    <p className="text-body text-ink-soft">{resolved}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="sr-only">{conceptCopy.a11y.bento}</p>
        </div>
      </Container>
    </Section>
  )
}
