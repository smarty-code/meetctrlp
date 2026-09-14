"use client"

import React, { useState } from "react"
import { FAQItem } from "../types/upload"
import { ChevronDown } from "lucide-react"

interface FAQSectionProps {
  items: FAQItem[]
}

export const FAQSection: React.FC<FAQSectionProps> = ({ items }) => {
  const [openId, setOpenId] = useState<string | null>(null)

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-10 pb-4 sm:px-6 sm:pt-14 md:px-8">
      <h3 className="mb-6 font-heading text-heading-sm tracking-heading text-midnight sm:text-heading">
        FAQ
      </h3>

      {/* Clean divide-y without redundant bottom border */}
      <div className="flex flex-col divide-y divide-graphite/15 border-t border-graphite/15">
        {items.map((item) => {
          const isOpen = openId === item.id
          return (
            <div key={item.id} className="py-4 transition-colors">
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className="group flex w-full items-center justify-between gap-4 py-1 text-left select-none"
                aria-expanded={isOpen}
              >
                <span className="text-body leading-snug font-bold text-midnight transition-colors group-hover:text-macaw-blue sm:text-[16px]">
                  {item.question}
                </span>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-macaw-blue transition-colors group-hover:bg-blue-50">
                  <ChevronDown
                    className={`size-5 stroke-[2.5] transition-transform duration-200 ${
                      isOpen ? "rotate-180 transform text-eel-dark-blue" : ""
                    }`}
                  />
                </span>
              </button>

              {isOpen && (
                <div className="animate-fadeIn pt-3 pr-8 pb-2 text-body leading-relaxed font-medium text-charcoal sm:text-[15.5px]">
                  <p>{item.answer}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
