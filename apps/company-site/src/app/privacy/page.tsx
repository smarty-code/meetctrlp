import React from "react"
import Link from "next/link"

export default function PrivacyPolicyPage() {
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
            Legal & Privacy
          </span>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl text-ink">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-ink-faint">Last updated: October 2026</p>

          <div className="mt-8 space-y-6 text-sm sm:text-base text-ink-soft leading-relaxed border-t border-neutral-200/80 pt-6">
            <section>
              <h2 className="text-lg font-bold text-ink">1. Information We Collect</h2>
              <p className="mt-2">
                When you submit a document to print through CtrlP, we process the document file, print specifications (e.g. page counts, color choices, copies), and order status. We do not require you to create an account or provide personal profiles. If you submit a call request or contact us via WhatsApp, we collect your name and provided phone number solely to respond to your request.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ink">2. How Documents Are Handled</h2>
              <p className="mt-2">
                Uploaded documents are transmitted using encrypted connections and processed exclusively to spool the print job to your chosen print shop. Documents are never sold, shared with third-party advertisers, or used to train artificial intelligence models.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ink">3. Document Retention & Purging</h2>
              <p className="mt-2">
                Files uploaded for printing are retained only for the duration required to complete fulfilment and handle job retries. Temporary spool files are automatically purged in accordance with our system lifecycle.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ink">4. Contact Us</h2>
              <p className="mt-2">
                If you have any questions about this privacy statement, please contact us at{" "}
                <a href="mailto:hello@meetctrlp.in" className="text-lime-deep underline">
                  hello@meetctrlp.in
                </a>.
              </p>
            </section>
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
