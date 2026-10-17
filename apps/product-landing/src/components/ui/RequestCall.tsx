"use client"

import dynamic from "next/dynamic"
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { events, type CtaLocation } from "@/config/analytics"
import { ctas } from "@/content/copy"
import { Button, type ButtonStyleProps } from "@/components/ui/Button"
import { track } from "@/lib/track"

const CallModal = dynamic(
  () =>
    import("@/components/sections/CallModal").then(
      (module) => module.CallModal
    ),
  {
    ssr: false,
  }
)

type RequestCallContextValue = { openCall: (location: CtaLocation) => void }

const RequestCallContext = createContext<RequestCallContextValue | null>(null)

/** Holds the one request-a-call modal; the modal code loads on first open (PRD 7.3). */
export function RequestCallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const openCall = useCallback((location: CtaLocation) => {
    track(events.requestCallOpen, { location })
    setLoaded(true)
    setOpen(true)
  }, [])

  const value = useMemo(() => ({ openCall }), [openCall])

  return (
    <RequestCallContext value={value}>
      {children}
      {loaded && <CallModal open={open} onClose={() => setOpen(false)} />}
    </RequestCallContext>
  )
}

/** Secondary CTA "Request a call" (PRD 3.4). */
export function RequestCallButton({
  location,
  variant = "secondary",
  ...style
}: ButtonStyleProps & { location: CtaLocation; className?: string }) {
  const context = use(RequestCallContext)
  return (
    <Button
      variant={variant}
      onClick={() => context?.openCall(location)}
      {...style}
    >
      {ctas.requestCall}
    </Button>
  )
}
