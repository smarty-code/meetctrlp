/**
 * Privacy-friendly event logging
 * Adheres to PRD Section 8.
 * No third-party ad pixels. No personal data in properties.
 */

export type AnalyticsEvent =
  | { name: "nav_click"; properties: { label: string } }
  | { name: "cta_explore_click"; properties: { location: "header" | "hero" } }
  | { name: "cta_print_shops_click"; properties: { location: string } }
  | { name: "door_user_click" }
  | { name: "door_shop_click" }
  | { name: "how_it_works_step_view"; properties: { step: 1 | 2 | 3 } }
  | { name: "whatsapp_click"; properties: { location: string } }
  | { name: "request_call_open" }
  | { name: "request_call_submit" }
  | { name: "section_view"; properties: { id: string } }

import { isDev } from "@/config/env"

export function trackEvent(event: AnalyticsEvent): void {
  // In development, log cleanly
  if (isDev) {
    console.debug("[Analytics Event]", event.name, "properties" in event ? event.properties : {})
  }

  // If a provider like Plausible / PostHog is loaded on window
  if (typeof window !== "undefined") {
    const customWindow = window as unknown as {
      plausible?: (name: string, options?: { props?: Record<string, unknown> }) => void
    }
    if (typeof customWindow.plausible === "function") {
      customWindow.plausible(event.name, {
        props: "properties" in event ? event.properties : undefined,
      })
    }
  }
}
