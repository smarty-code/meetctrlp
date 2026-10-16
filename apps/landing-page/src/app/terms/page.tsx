import React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { siteConfig } from "@/config/site-content"
import { ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: "Terms of Service — MeetCtrlP",
  description:
    "MeetCtrlP Terms of Service governing use of the CtrlP platform, customer web flows, and shop partner software.",
}

export default function TermsPage() {
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
              LEGAL AGREEMENT
            </span>
            <h1 className="mt-3 font-heading text-4xl font-black text-midnight sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-4 text-sm text-ash">
              Effective Date: October 2026 • Product Stage: MVP
            </p>
          </div>

          <div className="mt-12 space-y-8 text-sm leading-relaxed text-charcoal">
            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight">
                1. Acceptance of Terms
              </h2>
              <p className="mt-3">
                By accessing or using MeetCtrlP services, including our marketing website (meetctrlp.in), customer web application (app.meetctrlp.in), and shop desktop software, you agree to comply with and be bound by these Terms of Service.
              </p>
            </section>

            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight">
                2. Nature of the Service
              </h2>
              <p className="mt-3">
                CtrlP is a workflow software platform connecting individuals who need physical documents printed with independent local print shops. MeetCtrlP provides software enabling document submission, job configuration, and printer spooling. The physical printing, paper stock, and fulfilment are executed by independent shop partners.
              </p>
            </section>

            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight">
                3. User Obligations and Acceptable Content
              </h2>
              <p className="mt-3">
                You retain ownership of all documents submitted for printing. You agree not to upload:
              </p>
              <ul className="mt-3 space-y-2 list-disc pl-5">
                <li>Content that infringes upon copyright, trademark, or intellectual property rights.</li>
                <li>Unlawful, counterfeit, fraudulent, or defamatory materials.</li>
                <li>Files containing malicious software, viruses, or harmful code.</li>
              </ul>
            </section>

            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight">
                4. Pricing, Payments, and Onboarding
              </h2>
              <p className="mt-3">
                Per-page printing prices are set independently by each partner print shop according to their local equipment, paper stock, and operational rates. CtrlP displays the calculated total based on the shop&apos;s configured rate table.
              </p>
              <p className="mt-2">
                For print shop partners, software subscriptions and onboarding terms are governed by individual partner agreements during our MVP pilot phase.
              </p>
            </section>

            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight">
                5. Limitation of Liability
              </h2>
              <p className="mt-3">
                MeetCtrlP is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the maximum extent permitted by applicable law, MeetCtrlP disclaims all warranties, express or implied, regarding physical print output defects, paper jams, or shop availability.
              </p>
            </section>

            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight">
                6. Contact
              </h2>
              <p className="mt-3">
                For questions regarding these Terms, contact our legal team at{" "}
                <a
                  href={`mailto:${siteConfig.urls.email}`}
                  className="font-bold text-midnight underline hover:text-ecto-green"
                >
                  {siteConfig.urls.email}
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
