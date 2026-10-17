"use client"

import React, { useState } from "react"
import Link from "next/link"
import { getWhatsAppContactUrl } from "@/content/site-config"
import { RequestCallModal } from "@/components/sections/RequestCallModal"

export default function PrintShopsStubPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const whatsappUrl = getWhatsAppContactUrl(
    "Hi MeetCtrlP, I run a print shop and want to know more about CtrlP for Print Shops."
  )

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col font-sans selection:bg-lime-soft selection:text-ink">
      <div className="w-full max-w-6xl mx-auto border-x-0 lg:border-x border-neutral-200/80 flex flex-col justify-between min-h-screen bg-bg">
        <header className="w-full px-4 sm:px-6 lg:px-8 h-16 sm:h-[72px] flex items-center border-b border-neutral-200/80">
          <Link href="/" className="font-display text-2xl text-ink">
            MeetCtrlP
          </Link>
        </header>

        <main className="max-w-xl mx-auto my-auto text-center px-4 sm:px-6 py-16">
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-faint">
            For Print Shop Owners
          </span>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl text-ink">
            CtrlP for <span className="italic text-lime-deep">Print Shops.</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-ink-soft leading-relaxed">
            Receive structured print orders, automate job spooling to your connected printers, and end messy WhatsApp queues. Full onboarding details and compatibility lists are launching soon.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 rounded-full text-sm font-semibold bg-lime text-ink hover:brightness-95 transition-all shadow-xs"
            >
              Talk to us on WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-full text-sm font-semibold border border-ink text-ink hover:bg-ink hover:text-bg transition-colors"
            >
              Request a call
            </button>
          </div>

          <div className="mt-6">
            <Link href="/" className="text-xs font-semibold text-ink-faint hover:text-ink underline">
              ← Return to homepage
            </Link>
          </div>
        </main>

        <footer className="w-full text-center text-xs text-ink-faint border-t border-neutral-200/80 px-4 sm:px-6 lg:px-8 py-6">
          © 2026 MeetCtrlP. Made with care.
        </footer>
      </div>

      <RequestCallModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
