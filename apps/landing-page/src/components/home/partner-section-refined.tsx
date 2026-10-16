import React from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site-content"
import {
  Store,
  ArrowRight,
  MessageSquare,
  PhoneCall,
  FileCheck,
  Printer,
  Inbox,
} from "lucide-react"

export function PartnerSectionRefined() {
  const p = siteConfig.partner
  const benefitIcons = [Inbox, FileCheck, Printer]

  return (
    <section className="bg-[#fafbfa] py-20 sm:py-28 border-b border-graphite/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-eel-light px-2.5 py-1 text-xs font-bold text-midnight">
            <Store className="h-3.5 w-3.5 text-ecto-green" />
            <span>FOR PRINT SHOP OWNERS &amp; OPERATORS</span>
          </div>

          <h2 className="mt-4 font-heading text-3xl font-black tracking-tight text-midnight sm:text-5xl">
            {p.headline}
          </h2>

          <p className="mt-5 text-base sm:text-lg leading-relaxed text-charcoal font-normal">
            {p.copy}
          </p>
        </div>

        {/* 3 Benefits */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {p.benefits.map((benefit, idx) => {
            const Icon = benefitIcons[idx]
            return (
              <div
                key={benefit.title}
                className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-7 shadow-2xs"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-midnight">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-bold text-midnight">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-charcoal leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* Guided Onboarding Note + Direct Contact Options */}
        <div className="mt-12 rounded-2xl border border-graphite/15 bg-paper p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
          <div className="max-w-xl">
            <h3 className="font-heading text-base font-bold text-midnight">
              Guided Setup &amp; Device Verification
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-charcoal leading-relaxed">
              {p.guidedNote}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href={p.cta.href}
              className="btn-pressable-green inline-flex items-center gap-2 rounded-xl bg-ecto-green px-5 py-3 text-xs sm:text-sm font-bold text-midnight select-none"
            >
              <span>{p.cta.label}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <a
              href={p.whatsappCta.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pressable-lime inline-flex items-center gap-2 rounded-xl bg-paper px-4 py-3 text-xs sm:text-sm font-bold text-midnight select-none hover:bg-eel-light/30"
            >
              <MessageSquare className="h-4 w-4 text-green-600" />
              <span>WhatsApp</span>
            </a>

            <Link
              href={p.callCta.href}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-charcoal hover:text-midnight underline px-2 py-1"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Request a call</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
