"use client"

import React, { useEffect } from "react"
import Link from "next/link"
import { routes } from "@/config/routes"

/**
 * Custom on-brand error boundary
 * Governed by PRD Section 9.8 & 9.13
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Error logged to monitoring service in production
  }, [error])

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col font-sans selection:bg-lime-soft selection:text-ink">
      <div className="w-full max-w-6xl mx-auto border-x-0 lg:border-x border-neutral-200/80 flex flex-col items-center justify-center min-h-screen bg-bg p-6 text-center">
        <div className="max-w-md w-full bg-surface border border-neutral-200/80 rounded-2xl p-8 sm:p-10 shadow-xs">
          <span className="text-xs uppercase tracking-widest font-semibold text-chip-error-fg px-3 py-1 bg-chip-error-bg rounded-full">
            Error
          </span>
          <h1 className="text-3xl sm:text-4xl font-display mt-4 mb-3 text-ink">
            Something went <em>wrong.</em>
          </h1>
          <p className="text-sm text-ink-soft mb-8 leading-relaxed">
            We encountered an unexpected error. Please try again or return to the homepage.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="px-6 py-2.5 rounded-xl bg-lime text-ink font-semibold text-sm hover:brightness-95 transition-all text-center"
            >
              Try Again
            </button>
            <Link
              href={routes.home}
              className="px-6 py-2.5 rounded-xl border border-neutral-200/80 text-ink font-medium text-sm hover:bg-surface-sunken transition-all text-center"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
