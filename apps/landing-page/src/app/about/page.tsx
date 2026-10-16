import React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { siteConfig } from "@/config/site-content"
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"

export const metadata: Metadata = {
  title: "About MeetCtrlP — Thoughtful Everyday Software",
  description:
    "Learn about MeetCtrlP. We build thoughtful software that simplifies daily real-world workflows, starting with local print shops and document printing.",
}

export default function AboutPage() {
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
              {siteConfig.about.eyebrow}
            </span>
            <h1 className="mt-3 font-heading text-4xl font-black text-midnight sm:text-5xl">
              We believe everyday software can be better.
            </h1>
            <p className="mt-6 text-lg text-charcoal leading-relaxed">
              {siteConfig.about.lead}
            </p>
          </div>

          <div className="mt-14 space-y-10 text-charcoal leading-relaxed">
            <section className="rounded-2xl border border-graphite/15 bg-paper p-8 shadow-xs">
              <h2 className="font-heading text-2xl font-bold text-midnight">
                The Printing Routine
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed">
                If you have ever needed a document printed for university submissions, government paperwork, or business contracts, you know the routine: forward a document via WhatsApp, dictate settings across a noisy counter, wait for the shop operator to download it to their desktop, and hope the duplex margins don&apos;t shift.
              </p>
              <p className="mt-4 text-sm sm:text-base leading-relaxed">
                It works because shop operators are incredibly resilient and patient. But the software around them hasn&apos;t evolved in decades. They are forced to juggle consumer messaging apps, corrupted USB drives, and cumbersome printer driver dialogs for hundreds of customers every single day.
              </p>
            </section>

            <section className="rounded-2xl border border-graphite/15 bg-[#fbfdf9] p-8 shadow-xs">
              <h2 className="font-heading text-2xl font-bold text-midnight">
                Our Approach to Building CtrlP
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed">
                We believe in meeting users and operators where they already are. We don&apos;t ask customers to download heavy mobile apps or create accounts just to print three pages. And we don&apos;t ask print shops to replace their existing printers or change their operating systems.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-ecto-green shrink-0 mt-0.5" />
                  <span><strong>Zero-install customer experience:</strong> Runs entirely in mobile browsers via shop QR codes.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-ecto-green shrink-0 mt-0.5" />
                  <span><strong>Native Windows integration:</strong> Lightweight desktop software that interfaces with local GDI print spoolers.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-ecto-green shrink-0 mt-0.5" />
                  <span><strong>Document privacy first:</strong> Transient caching and automated deletion schedules for uploaded materials.</span>
                </li>
              </ul>
            </section>

            <div className="rounded-2xl border border-graphite/20 bg-midnight p-8 text-paper text-center">
              <p className="font-heading text-xl sm:text-2xl font-bold italic text-eel-light">
                &ldquo;{siteConfig.about.closingQuote}&rdquo;
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  href="/#demo"
                  className="btn-pressable-green inline-flex items-center gap-2 rounded-xl bg-ecto-green px-6 py-3 text-sm font-bold text-midnight select-none"
                >
                  <span>See How CtrlP Works</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
