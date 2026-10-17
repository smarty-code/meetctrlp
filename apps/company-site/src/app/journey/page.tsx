import React from "react"
import Link from "next/link"
import { siteConfig } from "@/content/site-config"
import { notFound } from "next/navigation"

export default function JourneyPage() {
  // PRD Section 3.1: Behind flag NEXT_PUBLIC_SHOW_JOURNEY (default false)
  if (!siteConfig.features.showJourney) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col font-sans selection:bg-lime-soft selection:text-ink">
      <div className="w-full max-w-6xl mx-auto border-x-0 lg:border-x border-neutral-200/80 flex flex-col justify-between min-h-screen bg-bg">
        <header className="w-full px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center border-b border-neutral-200/80">
          <Link href="/" className="font-display text-2xl text-ink">
            MeetCtrlP
          </Link>
        </header>

        <main className="max-w-2xl mx-auto my-12 px-4 sm:px-6 w-full">
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
            Building in Public
          </span>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl text-ink">
            Our Journey
          </h1>
          <p className="mt-4 text-base text-ink-soft">
            Updates, milestones, and learnings as we build thoughtful printing software.
          </p>

          <div className="mt-8 border-t border-neutral-200/80 pt-6">
            <article className="p-6 rounded-2xl bg-surface border border-neutral-200/80 shadow-xs">
              <span className="text-xs font-semibold text-lime-deep">October 2026</span>
              <h2 className="text-xl font-bold text-ink mt-1">Starting with print shops</h2>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed">
                We are working closely with campus print shops to understand daily order volume, queue friction, and printer hardware communication.
              </p>
            </article>
          </div>

          <div className="mt-12">
            <Link href="/" className="text-sm font-semibold text-ink underline">
              ← Back to MeetCtrlP
            </Link>
          </div>
        </main>

        <footer className="w-full text-center text-xs text-ink-faint border-t border-neutral-200/80 px-4 sm:px-6 lg:px-8 py-6">
          © 2026 MeetCtrlP. Made with care.
        </footer>
      </div>
    </div>
  )
}
