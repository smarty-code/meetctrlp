'use client';

import React, { useState } from 'react';
import { FAQItem } from '../types/upload';
import { ChevronDown } from 'lucide-react';

interface FAQSectionProps {
  items: FAQItem[];
}

export const FAQSection: React.FC<FAQSectionProps> = ({ items }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="w-full max-w-3xl mx-auto px-4 sm:px-6 md:px-8 pt-10 sm:pt-14 pb-4">
      <h3 className="font-heading text-heading-sm sm:text-heading text-midnight tracking-heading mb-6">
        FAQ
      </h3>

      {/* Clean divide-y without redundant bottom border */}
      <div className="flex flex-col divide-y divide-graphite/15 border-t border-graphite/15">
        {items.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div key={item.id} className="py-4 transition-colors">
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className="w-full flex items-center justify-between text-left gap-4 py-1 select-none group"
                aria-expanded={isOpen}
              >
                <span className="text-body sm:text-[16px] font-bold text-midnight group-hover:text-macaw-blue leading-snug transition-colors">
                  {item.question}
                </span>
                <span className="shrink-0 size-7 flex items-center justify-center text-macaw-blue rounded-lg group-hover:bg-blue-50 transition-colors">
                  <ChevronDown
                    className={`size-5 stroke-[2.5] transition-transform duration-200 ${
                      isOpen ? 'transform rotate-180 text-eel-dark-blue' : ''
                    }`}
                  />
                </span>
              </button>

              {isOpen && (
                <div className="pt-3 pb-2 text-body sm:text-[15.5px] leading-relaxed text-charcoal font-medium animate-fadeIn pr-8">
                  <p>{item.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
