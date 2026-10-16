import React from "react"
import Link from "next/link"

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col justify-between p-6 sm:p-12">
      <header className="max-w-[800px] w-full mx-auto">
        <Link href="/" className="font-display text-2xl text-ink">
          MeetCtrlP
        </Link>
      </header>

      <main className="max-w-[800px] w-full mx-auto my-12">
        <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
          Legal
        </span>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl text-ink">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-ink-faint">Last updated: October 2026</p>

        <div className="mt-8 space-y-6 text-sm sm:text-base text-ink-soft leading-relaxed border-t border-line pt-6">
          <section>
            <h2 className="text-lg font-bold text-ink">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By accessing MeetCtrlP or utilizing CtrlP to submit or process print orders, you agree to comply with and be bound by these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">2. User Responsibilities</h2>
            <p className="mt-2">
              Users are solely responsible for ensuring they possess all requisite legal rights, permissions, and licenses for documents uploaded to print shops via CtrlP. Uploading malicious, unlawful, or copyrighted material without authorization is strictly prohibited.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">3. Print Shop Partner Terms</h2>
            <p className="mt-2">
              Print shop partners operate as independent service providers. MeetCtrlP provides software workflow and order routing tools and does not assume liability for physical paper quality, ink defects, or shop equipment failures.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-ink">4. Modifications</h2>
            <p className="mt-2">
              We reserve the right to amend these terms at any time. Continued use of our software constitutes acceptance of any revised terms.
            </p>
          </section>
        </div>

        <div className="mt-12">
          <Link href="/" className="text-sm font-semibold text-ink underline">
            ← Back to MeetCtrlP
          </Link>
        </div>
      </main>

      <footer className="max-w-[800px] w-full mx-auto text-center text-xs text-ink-faint border-t border-line pt-6">
        © 2026 MeetCtrlP. Made with care.
      </footer>
    </div>
  )
}
