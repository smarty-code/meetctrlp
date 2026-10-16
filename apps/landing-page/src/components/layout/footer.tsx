import React from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site-content"
import { Printer } from "lucide-react"

export function Footer() {
  const f = siteConfig.footer

  return (
    <footer className="border-t border-graphite/10 bg-paper text-charcoal py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-midnight select-none"
              aria-label="MeetCtrlP Home"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ecto-green text-paper">
                <Printer className="h-3.5 w-3.5" strokeWidth={2.3} />
              </div>
              <span className="font-heading text-lg font-bold tracking-tight text-midnight">
                Meet<span className="text-ecto-green">CtrlP</span>
              </span>
            </Link>
            <span className="text-ash text-xs hidden sm:inline">•</span>
            <span className="text-xs text-ash hidden sm:inline">
              {f.brandStatement}
            </span>
          </div>

          {/* Links list */}
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            {f.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-charcoal transition-colors hover:text-midnight hover:underline underline-offset-4"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom line */}
        <div className="mt-8 border-t border-graphite/10 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-ash">
          <p>{f.copyright}</p>
          <p className="font-medium text-midnight">{f.closing}</p>
        </div>
      </div>
    </footer>
  )
}
