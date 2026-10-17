import React from "react"
import Link from "next/link"
import { siteCopy } from "@/content/copy"
import { siteConfig } from "@/content/site-config"

export function Footer() {
  const { footer } = siteCopy

  return (
    <footer className="w-full bg-bg text-ink border-t border-neutral-200/80">
      {/* Top Grid: Brand block on left, 3 link columns on right */}
      <div className="w-full px-6 sm:px-8 lg:px-12 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        {/* Brand Block (Cols 1-5) */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <Link href="/" className="font-display text-2xl text-ink tracking-tight">
              {footer.brand}
            </Link>
            <p className="mt-3 text-sm text-ink-soft max-w-xs leading-relaxed">
              {footer.tagline}
            </p>
          </div>
        </div>

        {/* Three Link Columns (Cols 6-12) */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-10 text-sm">
          {/* Product Column */}
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-xs tracking-wider uppercase text-ink-faint">
              {footer.colProduct.title}
            </span>
            <ul className="space-y-2.5">
              {footer.colProduct.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink-soft hover:text-ink transition-colors"
                  >
                    {link.label}
                  </Link>
                  {link.label === "Print User" && (
                    <span className="block text-[11px] text-ink-faint mt-0.5">
                      {footer.colProduct.userNote}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-xs tracking-wider uppercase text-ink-faint">
              {footer.colCompany.title}
            </span>
            <ul className="space-y-2.5">
              {footer.colCompany.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink-soft hover:text-ink transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {siteConfig.features.showJourney && (
                <li>
                  <Link
                    href={footer.colCompany.journeyLink.href}
                    className="text-ink-soft hover:text-ink transition-colors"
                  >
                    {footer.colCompany.journeyLink.label}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Legal Column */}
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-xs tracking-wider uppercase text-ink-faint">
              {footer.colLegal.title}
            </span>
            <ul className="space-y-2.5">
              {footer.colLegal.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink-soft hover:text-ink transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar with Hairline */}
      <div className="border-t border-neutral-200/80 px-6 sm:px-8 lg:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-faint">
        <p>{footer.bottomLine}</p>
        <p>meetctrlp.in</p>
      </div>
    </footer>
  )
}
