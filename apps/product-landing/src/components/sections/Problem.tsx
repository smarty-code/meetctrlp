import type { CSSProperties } from "react"
import { sectionIds } from "@/config/routes"
import { conceptCopy } from "@/content/concepts"
import { problemCopy } from "@/content/copy"
import { OrderCard } from "@/components/concepts/OrderCard"
import { Container } from "@/components/layout/Container"
import { headingId, Section } from "@/components/layout/Section"
import { ConceptCaption, ConceptTag } from "@/components/ui/ConceptTag"
import { Reveal } from "@/components/ui/Reveal"
import { DisplayHeading } from "@/components/ui/Typography"
import { SectionHeader } from "@/components/sections/SectionHeader"
import { describe } from "@/lib/concepts"
import { stagger } from "@/lib/motion"
import { cn } from "@/lib/cn"

/**
 * Where each scattered bubble and file chip sits (rotation within ±4°), and which way it
 * slides to reach the card in the centre. Layout only; the words come from content.
 */
const scatter = [
  { place: "start-4 top-6 -rotate-3", to: ["40%", "120%"] },
  { place: "end-4 top-12 rotate-2", to: ["-40%", "110%"] },
  { place: "start-8 top-1/3 rotate-1", to: ["35%", "40%"] },
  { place: "end-6 top-1/2 -rotate-2", to: ["-35%", "-10%"] },
  { place: "start-6 bottom-16 rotate-4", to: ["40%", "-90%"] },
  { place: "end-10 bottom-24 -rotate-1", to: ["-40%", "-120%"] },
  { place: "start-1/3 bottom-6 rotate-3", to: ["10%", "-160%"] },
] as const

function slide(index: number): CSSProperties {
  const target = scatter[index % scatter.length]?.to ?? ["0", "0"]
  return {
    ...stagger(index),
    "--to-x": target[0],
    "--to-y": target[1],
  } as CSSProperties
}

/** 5.4 The counter today. */
export function Problem() {
  const pieces = [
    ...problemCopy.bubbles.map((bubble) => ({
      text: bubble.text,
      kind: bubble.side,
    })),
    ...problemCopy.files.map((file) => ({ text: file, kind: "file" as const })),
  ]

  return (
    <Section id={sectionIds.problem}>
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-6">
          <div className="flex flex-col gap-8 lg:col-span-6">
            <SectionHeader
              id={headingId(sectionIds.problem)}
              intro={problemCopy}
            />
            <ul className="flex flex-col">
              {problemCopy.lines.map((line) => (
                <li
                  key={line}
                  className="border-t border-line py-4 text-h3 font-medium last:border-b"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <figure className="lg:col-span-6">
            <ConceptCaption description={describe(conceptCopy.a11y.problem)} />
            <Reveal
              scene
              className="relative flex h-problem-panel-sm items-center justify-center overflow-hidden rounded-xl bg-surface-sunken lg:h-problem-panel"
            >
              <ConceptTag />
              <div aria-hidden="true">
                {pieces.map((piece, index) => (
                  <span
                    key={piece.text}
                    style={slide(index)}
                    className={cn(
                      "problem-bubble absolute max-w-3/5 rounded-lg border border-line px-4 py-2 text-small",
                      scatter[index % scatter.length]?.place,
                      piece.kind === "file"
                        ? "bg-surface-sunken font-medium text-ink-soft"
                        : "bg-surface",
                      piece.kind === "shop" && "text-ink-soft"
                    )}
                  >
                    {piece.text}
                  </span>
                ))}
              </div>
              <OrderCard className="problem-card relative w-4/5 max-w-sm" />
            </Reveal>
            <p className="mt-3 text-caption text-ink-faint">
              {conceptCopy.tag.illustrative}
            </p>
          </figure>
        </div>
        <DisplayHeading
          as="p"
          size="m"
          headline={problemCopy.closing}
          className="mx-auto mt-24 max-w-3xl text-center"
        />
      </Container>
    </Section>
  )
}
