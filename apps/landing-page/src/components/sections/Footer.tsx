import React from "react"
import Link from "next/link"
import { siteCopy } from "@/content/copy"
import { siteConfig } from "@/content/site-config"

export function Footer() {
  const { footer } = siteCopy

  return (
    <footer className="w-full bg-bg border-t border-line py-16 text-ink">
      <div className="max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          {/* Brand Block (Cols 1-5) */}
          <div className="lg:col-span-5 flex flex-col items-start">
            <Link href="/" className="font-display text-2xl text-ink tracking-tight">
              {footer.brand}
            </Link>
            <p className="mt-3 text-sm text-ink-soft max-w-xs leading-relaxed">
              {footer.tagline}
            </p>
          </div>

          {/* Three Link Columns (Cols 7-12) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
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
            <div className="flex flex-col gap-3 col-span-2 sm:col-span-1">
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
        <div className="mt-16 pt-8 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-faint">
          <p>{footer.bottomLine}</p>
          <p>meetctrlp.in</p>
        </div>
      </div>
    </footer>
  )
}
