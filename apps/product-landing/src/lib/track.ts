import type { EventName, EventProps } from "@/config/analytics"

type Plausible = (
  name: string,
  options?: { props?: Record<string, string | number> }
) => void

/**
 * The single analytics wrapper (PRD 8, 9.3). Cookieless Plausible when configured, otherwise a no-op.
 * Properties are typed per event so contact details can never be passed in.
 */
export function track<E extends EventName>(
  ...[event, props]: EventProps[E] extends undefined ? [E] : [E, EventProps[E]]
): void {
  if (typeof window === "undefined") return
  const plausible = (window as Window & { plausible?: Plausible }).plausible
  if (typeof plausible !== "function") return
  plausible(
    event,
    props ? { props: props as Record<string, string | number> } : undefined
  )
}
