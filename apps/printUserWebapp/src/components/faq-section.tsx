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
    <section className="w-full px-5 pt-8 pb-2">
      <h3 className="font-heading text-heading text-midnight tracking-heading mb-4">
        FAQ
      </h3>

      {/* Clean divide-y without redundant bottom border */}
      <div className="flex flex-col divide-y divide-graphite/15 border-t border-graphite/15">
        {items.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div key={item.id} className="py-3.5 transition-colors">
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                className="w-full flex items-center justify-between text-left gap-4 py-1 select-none group"
                aria-expanded={isOpen}
              >
                <span className="text-body font-bold text-midnight group-hover:text-macaw-blue leading-snug transition-colors">
                  {item.question}
                </span>
                <span className="shrink-0 size-6 flex items-center justify-center text-macaw-blue">
                  <ChevronDown
                    className={`size-5 stroke-[2.5] transition-transform duration-200 ${
                      isOpen ? 'transform rotate-180 text-eel-dark-blue' : ''
                    }`}
                  />
                </span>
              </button>

              {isOpen && (
                <div className="pt-2 pb-1 text-body leading-body text-charcoal font-medium animate-fadeIn">
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
