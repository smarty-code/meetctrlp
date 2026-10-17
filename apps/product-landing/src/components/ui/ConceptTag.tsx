import { conceptCopy } from "@/content/concepts"
import { cn } from "@/lib/cn"

/**
 * "Concept" pill, top-right inside a visual (PRD 4.9). `live` is for real app screenshots.
 * The visible label is decorative; figures carry their own screen-reader caption.
 */
export function ConceptTag({
  kind = "concept",
  className,
}: {
  kind?: "concept" | "live"
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute end-4 top-4 z-20 inline-flex h-tag items-center gap-2 rounded-pill border border-line bg-surface px-3 text-caption text-ink-soft select-none",
        className
      )}
    >
      <span className="size-1.5 rounded-pill bg-lime" />
      {kind === "live" ? conceptCopy.tag.liveApp : conceptCopy.tag.concept}
    </span>
  )
}

/** Visually hidden caption every concept figure carries (PRD 4.9). */
export function ConceptCaption({ description }: { description?: string }) {
  return (
    <figcaption className="sr-only">
      {conceptCopy.tag.srCaption}
      {description && <> {description}</>}
    </figcaption>
  )
}

/** Small "Sample data" note under the first-in-view concepts (PRD 4.10). */
export function SampleDataNote({
  className,
  label = conceptCopy.tag.sampleData,
}: {
  className?: string
  label?: string
}) {
  return <p className={cn("text-caption text-ink-faint", className)}>{label}</p>
}
