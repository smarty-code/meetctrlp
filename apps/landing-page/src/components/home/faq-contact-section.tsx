"use client"

import React, { useState } from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site-content"
import { ChevronDown, MessageSquare, PhoneCall } from "lucide-react"

export function FaqContactSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const faq = siteConfig.faq

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="bg-paper py-20 sm:py-28 border-b border-graphite/10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl font-black text-midnight sm:text-4xl">
            {faq.headline}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-charcoal">
            {faq.lead}
          </p>
        </div>

        {/* Compact Accessible Accordion */}
        <div className="mt-12 space-y-3">
          {faq.items.map((item, idx) => {
            const isOpen = openIndex === idx
            return (
              <div
                key={item.question}
                className="rounded-xl border border-graphite/15 bg-paper transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between p-5 text-left font-heading text-sm sm:text-base font-bold text-midnight hover:bg-gray-50/70 transition-colors"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-ash transition-transform duration-200 shrink-0 ml-4 ${
                      isOpen ? "rotate-180 text-midnight" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    className="px-5 pb-5 pt-1 text-xs sm:text-sm text-charcoal leading-relaxed border-t border-graphite/5 bg-[#fafbfa]"
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Quick Contact Bar for Shop Owners */}
        <div className="mt-12 rounded-xl border border-graphite/15 bg-gray-50/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-midnight uppercase tracking-wider">
              Have another question?
            </p>
            <p className="text-xs text-charcoal mt-0.5">
              Speak directly with our team about your shop setup.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={siteConfig.urls.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pressable-lime inline-flex items-center gap-1.5 rounded-lg bg-paper px-3.5 py-2 text-xs font-bold text-midnight select-none hover:bg-eel-light/30"
            >
              <MessageSquare className="h-3.5 w-3.5 text-green-600" />
              <span>WhatsApp</span>
            </a>

            <Link
              href={siteConfig.urls.callRequestUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-graphite/20 px-3.5 py-2 text-xs font-bold text-midnight hover:bg-paper"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Schedule Call</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
