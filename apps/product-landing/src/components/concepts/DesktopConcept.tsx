import type { ReactNode } from "react"
import { conceptCopy } from "@/content/concepts"
import { ConceptCaption } from "@/components/ui/ConceptTag"
import {
  AgentScreen,
  FailureScreen,
  JobScreen,
  PaymentScreen,
  PricingScreen,
  QueueScreen,
  RoutingScreen,
  type JobState,
  type QueueState,
} from "@/components/concepts/desktopScreens"
import { cn } from "@/lib/cn"

export type DesktopScreen =
  "queue" | "job" | "payment" | "routing" | "failure" | "pricing" | "agent"

type DesktopConceptProps = {
  screen: DesktopScreen
  /** `window` draws the 16:10 app window; `panel` is just the screen content, for bento tiles. */
  variant?: "window" | "panel"
  queue?: QueueState
  job?: JobState
  description?: string
  figure?: boolean
  className?: string
}

/**
 * Shop desktop app concept (PRD 4.10): 16:10, radius 16, 1px border, a title bar with three
 * neutral dots and "CtrlP for Print Shops". Sized in concept units so it scales with its container.
 */
export function DesktopConcept({
  screen,
  variant = "window",
  queue,
  job,
  description,
  figure = true,
  className,
}: DesktopConceptProps) {
  const Wrapper = figure ? "figure" : "div"
  const body = <ScreenBody screen={screen} queue={queue} job={job} />

  return (
    <Wrapper className={cn("@container block w-full", className)}>
      {figure && <ConceptCaption {...(description ? { description } : {})} />}
      {variant === "window" ? (
        <div
          aria-hidden={figure ? undefined : true}
          className="flex aspect-desktop flex-col overflow-hidden rounded-desktop border border-line bg-surface text-ink shadow-card concept-desktop"
        >
          <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-line bg-bg px-3">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="size-2.5 rounded-pill bg-line" />
            ))}
            <p className="flex-1 pe-12 text-center text-ui-2xs text-ink-faint">
              {conceptCopy.desktop.windowTitle}
            </p>
          </div>
          <div className="flex min-h-0 flex-1">{body}</div>
        </div>
      ) : (
        <div
          aria-hidden={figure ? undefined : true}
          className="flex overflow-hidden rounded-desktop border border-line bg-surface text-ink concept-panel"
        >
          {body}
        </div>
      )}
    </Wrapper>
  )
}

function ScreenBody({
  screen,
  queue,
  job,
}: {
  screen: DesktopScreen
  queue: QueueState | undefined
  job: JobState | undefined
}): ReactNode {
  switch (screen) {
    case "queue":
      return <QueueScreen state={queue ?? {}} />
    case "job":
      return <JobScreen state={job ?? "printing"} />
    case "payment":
      return <PaymentScreen />
    case "routing":
      return <RoutingScreen />
    case "failure":
      return <FailureScreen />
    case "pricing":
      return <PricingScreen />
    case "agent":
      return <AgentScreen />
  }
}
