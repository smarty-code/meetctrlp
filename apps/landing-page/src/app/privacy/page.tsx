import React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { siteConfig } from "@/config/site-content"
import { ArrowLeft, ShieldCheck, Lock, Clock, FileText } from "lucide-react"

export const metadata: Metadata = {
  title: "Privacy Policy — MeetCtrlP",
  description:
    "MeetCtrlP Privacy Policy and Document Handling Principles. Transparent, secure transient file lifecycle and access control for printing orders.",
}

export default function PrivacyPage() {
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
              LEGAL & PRIVACY PRINCIPLES
            </span>
            <h1 className="mt-3 font-heading text-4xl font-black text-midnight sm:text-5xl">
              Privacy Policy & Document Handling
            </h1>
            <p className="mt-4 text-sm text-ash">
              Last updated: October 2026 • Product Stage: MVP
            </p>
          </div>

          <div className="mt-12 space-y-8 text-sm leading-relaxed text-charcoal">
            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight flex items-center gap-2">
                <Lock className="h-5 w-5 text-ecto-green" />
                <span>1. Overview and Core Philosophy</span>
              </h2>
              <p className="mt-3">
                {siteConfig.privacyTrust.lead}
              </p>
              <p className="mt-2">
                MeetCtrlP (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the CtrlP print platform. We respect the confidentiality of every customer document submitted through our services. We do not sell user data, train AI models on user documents, or inspect file contents for advertising.
              </p>
            </section>

            <section id="retention" className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight flex items-center gap-2">
                <Clock className="h-5 w-5 text-ecto-green" />
                <span>2. Transient Document Retention Lifecycle</span>
              </h2>
              <p className="mt-3">
                Printing physical documents requires temporary digital transmission and spooling. To deliver print orders reliably while safeguarding user privacy, we enforce the following verified retention lifecycle:
              </p>
              <ul className="mt-4 space-y-2.5 list-disc pl-5">
                <li>
                  <strong>Upload and In-Transit Encryption:</strong> Files uploaded via the customer web app are encrypted in transit using industry-standard Transport Layer Security (TLS 1.3).
                </li>
                <li>
                  <strong>Temporary Storage:</strong> Files are stored in secured private cloud buckets accessible only through short-lived cryptographic signed URLs.
                </li>
                <li>
                  <strong>Local Spooling Buffer:</strong> When the shop desktop agent accepts an order, the document is downloaded to a restricted, encrypted local application cache for spooling to the printer driver.
                </li>
                <li>
                  <strong>Automated Deletion:</strong> Upon completion or cancellation of the order, documents are scheduled for automated purge from both cloud storage and the shop agent&apos;s local cache.
                </li>
              </ul>
              <div className="mt-4 rounded-lg bg-gray-50 p-4 border border-graphite/10 text-xs text-ash">
                <strong>Publication Governance Note:</strong> We strictly avoid claiming permanent &ldquo;zero retention&rdquo; or &ldquo;end-to-end homomorphic encryption&rdquo; because digital print spoolers require temporary buffers to communicate with physical printer firmware.
              </div>
            </section>

            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-ecto-green" />
                <span>3. Access Control & Shop Boundaries</span>
              </h2>
              <p className="mt-3">
                Orders and uploaded documents are strictly scoped to the specific shop QR code scanned by the customer. No other print shop on the CtrlP network can access, view, or search orders destined for another location.
              </p>
              <p className="mt-2">
                Print shop operators are independent local businesses. They agree to use the CtrlP desktop software exclusively for fulfilling customer-authorized print jobs.
              </p>
            </section>

            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight flex items-center gap-2">
                <FileText className="h-5 w-5 text-ecto-green" />
                <span>4. Telemetry and Analytics</span>
              </h2>
              <p className="mt-3">
                To diagnose printer driver errors, crash reports, and system performance, we collect operational telemetry:
              </p>
              <ul className="mt-3 space-y-1.5 list-disc pl-5">
                <li>Printer driver status (offline, paper jam, ready)</li>
                <li>Job duration and page count statistics</li>
                <li>System event timestamps and error codes</li>
              </ul>
              <p className="mt-3">
                Operational telemetry never records file contents, sensitive document text, or unverified customer personal identity.
              </p>
            </section>

            <section className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-midnight">
                5. Contacting the Data Protection Team
              </h2>
              <p className="mt-3">
                If you have questions regarding document privacy, retention, or security practices, contact us at:{" "}
                <a
                  href={`mailto:${siteConfig.urls.email}`}
                  className="font-bold text-midnight underline hover:text-ecto-green"
                >
                  {siteConfig.urls.email}
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
