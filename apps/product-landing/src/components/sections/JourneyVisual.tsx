import { conceptCopy } from "@/content/concepts"
import type { JourneyScene } from "@/content/steps"
import { DesktopConcept } from "@/components/concepts/DesktopConcept"
import { PhoneConcept } from "@/components/concepts/PhoneConcept"
import { UiButton } from "@/components/concepts/parts"
import { cn } from "@/lib/cn"

/** The concept each journey step shows (PRD 5.2), centred in its painted panel. */
export function JourneyVisual({
  scene,
  className,
}: {
  scene: JourneyScene
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "absolute inset-0 flex items-center justify-center p-6 pt-16",
        className
      )}
    >
      {scene === "upload" && <Phone screen="upload" />}
      {scene === "configure" && <Phone screen="configure" />}
      {scene === "accept" && <Desktop screen="queue" panel="accept" />}
      {scene === "print" && <Desktop screen="job" />}
      {scene === "ready" && (
        <div className="relative flex h-full items-center">
          <Phone screen="track" />
          <ReadyCorner />
        </div>
      )}
    </div>
  )
}

function Phone({ screen }: { screen: "upload" | "configure" | "track" }) {
  return (
    <div className="aspect-phone h-full max-h-full">
      <PhoneConcept screen={screen} figure={false} />
    </div>
  )
}

function Desktop({
  screen,
  panel,
}: {
  screen: "queue" | "job"
  panel?: "accept"
}) {
  return (
    <DesktopConcept
      screen={screen}
      figure={false}
      {...(panel ? { queue: { panel } } : { job: "printing" as const })}
      className="max-w-desktop"
    />
  )
}

/** Small desktop corner for step 05: "Mark ready" → "Complete order". */
function ReadyCorner() {
  const { desktop, glyphs } = conceptCopy
  return (
    <div className="absolute -end-4 bottom-8 flex w-40 flex-col gap-2 rounded-ui-lg border border-line bg-surface p-3 text-ink shadow-card sm:-end-24">
      <UiButton tone="outline" className="gap-1">
        <span className="text-lime-deep">{glyphs.check}</span>
        {desktop.markReady}
      </UiButton>
      <UiButton>{desktop.completeOrder}</UiButton>
    </div>
  )
}
