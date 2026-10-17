"use client"

import { useEffect, useRef, useState } from "react"
import { events } from "@/config/analytics"
import { routes, sectionIds } from "@/config/routes"
import { ui } from "@/config/ui"
import { headerCopy, primaryNav } from "@/content/nav"
import { Container } from "@/components/layout/Container"
import { CustomerAppLink, WhatsAppButton } from "@/components/ui/TrackedLinks"
import { cn } from "@/lib/cn"
import { track } from "@/lib/track"

/** Sticky header (PRD 3.3): transparent over the hero, solid with blur after 24px of scroll. */
export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > ui.headerScrollThreshold)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [])

  return (
    <>
      <a
        href={`#${sectionIds.main}`}
        className="sr-only z-50 rounded-pill bg-ink px-4 py-3 text-small text-bg focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {headerCopy.skipLink}
      </a>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b safe-top transition-colors duration-standard ease-standard",
          scrolled ? "border-line header-scrolled" : "border-transparent"
        )}
      >
        <Container className="flex h-header items-center justify-between gap-4 lg:h-header-lg">
          <a
            href={routes.home}
            aria-label={headerCopy.homeLabel}
            className="flex min-h-tap items-baseline gap-2"
          >
            <span className="font-display text-display-m leading-none">
              {headerCopy.wordmark}
            </span>
            <span className="hidden text-caption text-ink-faint sm:inline">
              {headerCopy.wordmarkLabel}
            </span>
          </a>
          <nav aria-label={headerCopy.navLabel} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {primaryNav.map((link) => (
                <li key={link.target}>
                  <a
                    href={`#${link.target}`}
                    onClick={() =>
                      track(events.navClick, { label: link.label })
                    }
                    className="inline-flex min-h-tap items-center rounded-pill px-4 text-small text-ink-soft transition-colors duration-micro hover:text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-2">
            <CustomerAppLink
              location="header"
              className="hidden xl:inline-flex"
            >
              {headerCopy.customerLink}
            </CustomerAppLink>
            <WhatsAppButton location="header" size="compact">
              {headerCopy.talkShort}
            </WhatsAppButton>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="inline-flex size-tap items-center justify-center rounded-pill border border-line lg:hidden"
            >
              <span className="sr-only">{headerCopy.openMenu}</span>
              <MenuGlyph />
            </button>
          </div>
        </Container>
      </header>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}

function MenuGlyph() {
  return (
    <span aria-hidden="true" className="flex w-4 flex-col gap-1">
      <span className="h-px w-full bg-ink" />
      <span className="h-px w-full bg-ink" />
      <span className="h-px w-full bg-ink" />
    </span>
  )
}

/** Full-screen menu sheet on a native <dialog>: focus trapped, Escape and link clicks close it. */
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      id="mobile-menu"
      aria-label={headerCopy.menuTitle}
      onClose={onClose}
      className="m-0 size-full max-h-none max-w-none bg-bg p-0 text-ink backdrop:bg-transparent"
    >
      <Container className="flex min-h-full flex-col gap-10 pb-10">
        <div className="flex h-header items-center justify-between">
          <span className="font-display text-display-m leading-none">
            {headerCopy.wordmark}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-tap items-center justify-center rounded-pill border border-line"
          >
            <span className="sr-only">{headerCopy.closeMenu}</span>
            <span aria-hidden="true" className="text-h3">
              {"×"}
            </span>
          </button>
        </div>
        <nav aria-label={headerCopy.navLabel}>
          <ul className="flex flex-col">
            {primaryNav.map((link) => (
              <li key={link.target} className="border-b border-line">
                <a
                  href={`#${link.target}`}
                  onClick={() => {
                    track(events.navClick, { label: link.label })
                    onClose()
                  }}
                  className="flex min-h-tap items-center py-4 font-display text-display-m"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col items-stretch gap-3">
          <WhatsAppButton
            location="menu"
            block
            className="sm:w-full"
            onClick={onClose}
          />
          <CustomerAppLink
            location="menu"
            className="justify-start"
            onClick={onClose}
          >
            {headerCopy.customerLink}
          </CustomerAppLink>
        </div>
      </Container>
    </dialog>
  )
}
