import React from "react"
import Link from "next/link"
import { getWhatsAppContactUrl } from "@/content/site-config"

export default function PrintUserStubPage() {
  const whatsappUrl = getWhatsAppContactUrl(
    "Hi MeetCtrlP, I would like to know how to print using CtrlP."
  )

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col justify-between p-6 sm:p-12">
      <header className="max-w-[1200px] w-full mx-auto">
        <Link href="/" className="font-display text-2xl text-ink">
          MeetCtrlP
        </Link>
      </header>

      <main className="max-w-xl mx-auto my-auto text-center py-16">
        <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
          Print User Experience
        </span>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl text-ink">
          Printing starts with a <span className="italic text-lime-deep">QR code.</span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-ink-soft leading-relaxed">
          CtrlP orders are initiated directly at participating campus print shops by scanning the counter QR code from any smartphone camera. No app download or account creation is required.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-3 rounded-full text-sm font-semibold border border-ink text-ink hover:bg-ink hover:text-bg transition-colors"
          >
            ← Back to Home
          </Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-3 rounded-full text-sm font-semibold bg-lime text-ink hover:brightness-95 transition-all shadow-xs"
          >
            Ask us on WhatsApp
          </a>
        </div>
      </main>

      <footer className="max-w-[1200px] w-full mx-auto text-center text-xs text-ink-faint border-t border-line pt-6">
        © 2026 MeetCtrlP. Made with care.
      </footer>
    </div>
  )
}
