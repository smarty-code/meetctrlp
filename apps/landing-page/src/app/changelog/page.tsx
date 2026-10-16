import React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { siteConfig } from "@/config/site-content"
import { CheckCircle2, ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Changelog & Product Journey — MeetCtrlP",
  description:
    "Follow our verified development journey. Transparent product milestones, architecture updates, and printer integration features shipped for CtrlP.",
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-paper text-charcoal font-sans selection:bg-eel-light selection:text-midnight">
      <Header />

      <main className="py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ash hover:text-midnight"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to MeetCtrlP</span>
          </Link>

          <div className="mt-8">
            <span className="text-xs font-bold uppercase tracking-wider text-ash">
              {siteConfig.changelog.eyebrow}
            </span>
            <h1 className="mt-3 font-heading text-4xl font-black text-midnight sm:text-5xl">
              Our Journey & Product Changelog
            </h1>
            <p className="mt-4 text-base sm:text-lg text-charcoal leading-relaxed">
              {siteConfig.changelog.lead} We publish only verified, shipped improvements tested against real print queues.
            </p>
          </div>

          {/* Timeline of entries */}
          <div className="mt-14 space-y-10">
            {siteConfig.changelog.entries.map((entry) => (
              <article
                key={entry.version}
                className="rounded-2xl border border-graphite/15 bg-paper p-6 sm:p-8 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite/10 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-midnight px-2.5 py-1 text-xs font-bold text-paper font-mono">
                      {entry.version}
                    </span>
                    <h2 className="font-heading text-xl font-bold text-midnight">
                      {entry.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ash">
                    <span className="rounded bg-eel-light px-2 py-0.5 font-bold text-midnight">
                      Shipped
                    </span>
                    <span>{entry.date}</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-12">
                  <div className="md:col-span-7">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ash">
                      What Changed
                    </h3>
                    <ul className="mt-3 space-y-2.5">
                      {entry.whatChanged.map((change) => (
                        <li
                          key={change}
                          className="flex items-start gap-2.5 text-xs sm:text-sm text-charcoal"
                        >
                          <CheckCircle2 className="h-4 w-4 text-ecto-green shrink-0 mt-0.5" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="md:col-span-5 rounded-xl bg-gray-50 p-4 border border-graphite/10">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ash">
                      Why It Matters
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-charcoal leading-relaxed">
                      {entry.whyItMatters}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-16 text-center rounded-xl border border-dashed border-graphite/30 p-8 text-xs text-ash">
            Next releases are deployed continuously to our test shops. Have suggestions?{" "}
            <Link href="/#contact" className="font-bold text-midnight underline">
              Get in touch
            </Link>
            .
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
