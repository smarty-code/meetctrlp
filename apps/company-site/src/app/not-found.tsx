import React from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site"
import { routes } from "@/config/routes"

/**
 * Custom on-brand 404 page
 * Governed by PRD Section 3.1 & 9.8
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col font-sans selection:bg-lime-soft selection:text-ink">
      <div className="w-full max-w-6xl mx-auto border-x-0 lg:border-x border-neutral-200/80 flex flex-col items-center justify-center min-h-screen bg-bg p-6 text-center">
        <div className="max-w-md w-full bg-surface border border-neutral-200/80 rounded-2xl p-8 sm:p-10 shadow-xs">
          <span className="text-xs uppercase tracking-widest font-semibold text-lime-deep px-3 py-1 bg-lime-soft rounded-full">
            404 Not Found
          </span>
          <h1 className="text-3xl sm:text-4xl font-display mt-4 mb-3 text-ink">
            Page not <em>found.</em>
          </h1>
          <p className="text-sm text-ink-soft mb-8 leading-relaxed">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={routes.home}
              className="px-6 py-2.5 rounded-xl bg-lime text-ink font-semibold text-sm hover:brightness-95 transition-all text-center"
            >
              Back to Home
            </Link>
            <a
              href={siteConfig.urls.contact}
              className="px-6 py-2.5 rounded-xl border border-neutral-200/80 text-ink font-medium text-sm hover:bg-surface-sunken transition-all text-center"
            >
              Contact us
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
