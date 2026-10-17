"use client"

import React, { useState } from "react"
import { siteCopy } from "@/content/copy"
import { getWhatsAppContactUrl, getMailtoContactUrl } from "@/content/site-config"
import { Hills } from "@/components/concepts/Hills"
import { RequestCallModal } from "./RequestCallModal"
import { trackEvent } from "@/lib/analytics"

export function ContactSection() {
  const { contact } = siteCopy
  const [modalOpen, setModalOpen] = useState(false)

  const whatsappUrl = getWhatsAppContactUrl()
  const mailtoUrl = getMailtoContactUrl()

  return (
    <>
      <section
        id="contact"
        className="relative bg-forest text-ink-on-forest rounded-t-[32px] sm:rounded-t-[48px] overflow-hidden pt-20 pb-24 sm:py-28"
        aria-label="Contact and lead capture"
      >
        {/* Subtle Dark Sky Hills Background */}
        <Hills variant="sky" isDark={true} />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left Column (Cols 1-6) */}
            <div className="lg:col-span-6 flex flex-col items-start max-w-lg">
              <span className="text-xs font-semibold tracking-[0.14em] uppercase text-ink-on-forest/60">
                {contact.bracket}
              </span>

              <h2 className="mt-4 font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.02] tracking-[-0.025em] text-ink-on-forest">
                {contact.h2Start}
                <span className="italic text-lime block sm:inline">
                  {contact.h2Emphasis}
                </span>
              </h2>

              <p className="mt-6 text-base sm:text-lg text-ink-on-forest/80 leading-[1.6]">
                {contact.body}
              </p>
            </div>

            {/* Right Column: Two Stacked Action Blocks (Cols 8-12) */}
            <div className="lg:col-span-6 lg:col-start-7 flex flex-col gap-8">
              {/* Block 1: For Print Shop Owners */}
              <div className="bg-forest/60 border border-line-on-forest p-6 sm:p-8 rounded-3xl backdrop-blur-xs flex flex-col gap-4">
                <span className="text-xs font-bold tracking-[0.12em] uppercase text-lime">
                  {contact.block1.label}
                </span>
                <p className="text-sm sm:text-base text-ink-on-forest/90 leading-[1.6]">
                  {contact.block1.text}
                </p>

                <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 rounded-full font-semibold text-center bg-lime text-ink hover:brightness-95 active:scale-95 transition-all text-sm shadow-xs"
                    onClick={() => trackEvent({ name: "whatsapp_click", properties: { location: "contact_section" } })}
                  >
                    {contact.block1.whatsappBtn}
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(true)
                      trackEvent({ name: "request_call_open" })
                    }}
                    className="px-6 py-3.5 rounded-full font-semibold text-center bg-transparent border border-line-on-forest text-ink-on-forest hover:bg-line-on-forest/40 active:scale-95 transition-all text-sm"
                  >
                    {contact.block1.requestCallBtn}
                  </button>
                </div>
              </div>

              {/* Hairline Divider */}
              <div className="h-px bg-line-on-forest w-full" />

              {/* Block 2: For General Enquiries */}
              <div className="p-2 sm:p-4 flex flex-col gap-2">
                <span className="text-xs font-bold tracking-[0.12em] uppercase text-ink-on-forest/60">
                  {contact.block2.label}
                </span>
                <p className="text-sm text-ink-on-forest/75 leading-[1.6]">
                  {contact.block2.text}
                </p>

                <div className="mt-2">
                  <a
                    href={mailtoUrl}
                    className="group text-sm font-semibold text-lime hover:underline inline-flex items-center gap-1.5"
                  >
                    <span>Contact us</span>
                    <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
                      →
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Request a Call Modal */}
      <RequestCallModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
