import type { ReactNode } from "react"
import { ConceptCaption } from "@/components/ui/ConceptTag"
import {
  PayScreen,
  ConfigureScreen,
  TrackScreen,
  UploadScreen,
} from "@/components/concepts/phoneScreens"
import { cn } from "@/lib/cn"

export type PhoneScreen = "upload" | "configure" | "pay" | "track"

type PhoneConceptProps = {
  screen: PhoneScreen
  /** Hero loop: the "Pay with UPI" press. */
  pressed?: boolean
  /** Accessible description of what the screen shows. */
  description?: string
  /** Set false when a parent figure already carries the caption. */
  figure?: boolean
  className?: string
}

/**
 * Phone frame (PRD 4.10): 280 × 570 design size, 40 radius, 8 ink bezel, notch pill.
 * Everything inside is sized in concept units, so it scales with the width the parent gives it.
 */
export function PhoneConcept({
  screen,
  pressed = false,
  description,
  figure = true,
  className,
}: PhoneConceptProps) {
  const Wrapper = figure ? "figure" : "div"
  return (
    <Wrapper className={cn("@container block w-full max-w-phone", className)}>
      {figure && <ConceptCaption {...(description ? { description } : {})} />}
      <div
        aria-hidden={figure ? undefined : true}
        className="aspect-phone rounded-phone bg-ink p-2 shadow-card concept-phone"
      >
        <div className="flex size-full flex-col overflow-hidden rounded-phone-screen bg-surface text-ink">
          <div className="mx-auto mt-2.5 h-5 w-20 shrink-0 rounded-pill bg-ink" />
          <ScreenBody screen={screen} pressed={pressed} />
        </div>
      </div>
    </Wrapper>
  )
}

function ScreenBody({
  screen,
  pressed,
}: {
  screen: PhoneScreen
  pressed: boolean
}): ReactNode {
  switch (screen) {
    case "upload":
      return <UploadScreen />
    case "configure":
      return <ConfigureScreen />
    case "pay":
      return <PayScreen pressed={pressed} />
    case "track":
      return <TrackScreen />
  }
}
