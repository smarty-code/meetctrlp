"use client"

import type { AnchorHTMLAttributes, ReactNode } from "react"
import { events, type CtaLocation } from "@/config/analytics"
import { site } from "@/config/site"
import { ctas } from "@/content/copy"
import { conceptCopy } from "@/content/concepts"
import {
  ButtonLink,
  LinkArrow,
  type ButtonStyleProps,
} from "@/components/ui/Button"
import { whatsappLink } from "@/lib/links"
import { track } from "@/lib/track"

type LinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "children"
> &
  ButtonStyleProps & { location: CtaLocation; children?: ReactNode }

/** Primary CTA: opens WhatsApp with the prefilled message and records `whatsapp_click`. */
export function WhatsAppButton({
  location,
  children,
  variant = "primary",
  onClick,
  ...props
}: LinkProps) {
  return (
    <ButtonLink
      href={whatsappLink(ctas.whatsappMessage)}
      target="_blank"
      rel="noopener noreferrer"
      variant={variant}
      onClick={(event) => {
        track(events.whatsappClick, { location })
        onClick?.(event)
      }}
      {...props}
    >
      {children ?? ctas.whatsapp}
    </ButtonLink>
  )
}

/** Any link to the Print User app, recorded as `customer_app_click`. */
export function CustomerAppLink({
  location,
  children,
  variant = "quiet",
  arrow = true,
  onClick,
  ...props
}: LinkProps & { arrow?: boolean }) {
  return (
    <ButtonLink
      href={site.appUrl}
      target="_blank"
      rel="noopener noreferrer"
      variant={variant}
      onClick={(event) => {
        track(events.customerAppClick, { location })
        onClick?.(event)
      }}
      {...props}
    >
      {children ?? ctas.openApp}
      {arrow && <LinkArrow glyph={conceptCopy.glyphs.arrow} />}
    </ButtonLink>
  )
}
