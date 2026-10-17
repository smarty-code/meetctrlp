import { routes, sectionIds } from "@/config/routes"
import { site } from "@/config/site"
import type { ExternalLink, NavLink } from "@/types/content"

/** Header navigation (PRD 3.3). Reordering or adding a link needs no component change. */
export const primaryNav = [
  { label: "How it works", target: sectionIds.journey },
  { label: "For shops", target: sectionIds.shops },
  { label: "Plans", target: sectionIds.plans },
  { label: "FAQ", target: sectionIds.faq },
] as const satisfies readonly NavLink[]

export const headerCopy = {
  wordmark: "CtrlP",
  wordmarkLabel: "for print shops",
  homeLabel: "CtrlP for print shops, home",
  navLabel: "Primary",
  skipLink: "Skip to content",
  customerLink: "Customer? Open the app",
  talkShort: "Talk to us",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  menuTitle: "Menu",
} as const

export type FooterColumn = {
  readonly title: string
  readonly links: ReadonlyArray<{
    readonly label: string
    readonly href: string
  }>
}

/** Footer (PRD 5.13). */
export const footerCopy = {
  brand: "CtrlP",
  byline: "by MeetCtrlP",
  tagline: "Thoughtful software for everyday work.",
  bottomLine: "© {year} MeetCtrlP. Made with care.",
  navLabel: "Footer",
  columns: [
    {
      title: "Explore",
      links: [
        { label: "How it works", href: `/#${sectionIds.journey}` },
        { label: "For shops", href: `/#${sectionIds.shops}` },
        { label: "Plans", href: `/#${sectionIds.plans}` },
        { label: "FAQ", href: `/#${sectionIds.faq}` },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "MeetCtrlP", href: site.mainSiteUrl },
        { label: "Contact", href: `/#${sectionIds.contact}` },
        { label: "Print app", href: site.appUrl },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: routes.privacy },
        { label: "Terms of Service", href: routes.terms },
      ],
    },
  ],
} as const satisfies { columns: readonly FooterColumn[] } & Record<
  string,
  unknown
>

export const customerAppLink = {
  label: "Open the print app",
  href: site.appUrl,
} as const satisfies ExternalLink
