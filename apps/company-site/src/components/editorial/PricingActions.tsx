"use client"

import { useState } from "react"
import Link from "next/link"
import { pricingPage } from "@/content/pages"
import { getWhatsAppContactUrl } from "@/content/site-config"
import { RequestCallModal } from "@/components/sections/RequestCallModal"
import { RollText } from "@/components/editorial/RollText"
import { trackEvent } from "@/lib/analytics"

/** "Contact us for pricing" plus the WhatsApp and request-a-call alternatives from the homepage. */
export function PricingActions() {
  const [modalOpen, setModalOpen] = useState(false)
  const { card } = pricingPage

  return (
    <>
      <Link
        href={card.cta.href}
        className="group relative inline-flex w-full md:w-auto items-center justify-center px-6 py-3.5 rounded-lg text-sm font-semibold bg-lime text-ink hover:brightness-95 transition-[filter] shadow-xs"
      >
        <RollText label={card.cta.label} />
      </Link>
      <p className="mt-3 text-xs md:text-sm text-ink-faint leading-relaxed">
        {card.altLead}{" "}
        <a
          href={getWhatsAppContactUrl(card.whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-soft underline underline-offset-4 hover:text-ink transition-colors"
          onClick={() => trackEvent({ name: "whatsapp_click", properties: { location: "pricing" } })}
        >
          {card.altWhatsapp}
        </a>{" "}
        {card.altJoiner}{" "}
        <button
          type="button"
          className="text-ink-soft underline underline-offset-4 hover:text-ink transition-colors"
          onClick={() => {
            trackEvent({ name: "request_call_open" })
            setModalOpen(true)
          }}
        >
          {card.altCall}
        </button>
        .
      </p>
      <RequestCallModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
