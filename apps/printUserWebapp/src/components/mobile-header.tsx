'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface MobileHeaderProps {
  onSearch?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onSearch,
}) => {
  return (
    <header className="w-full bg-[#0283fd] text-paper select-none relative z-20">
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Left: Brand tag on desktop, invisible spacer on mobile */}
        <div className="flex items-center gap-2">
          <span className="hidden md:inline-block font-heading text-[22px] tracking-tight text-paper font-black">
            CtrlP
          </span>
          <div className="size-10 md:hidden" />
        </div>

        {/* Center: Trust pill */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-caption font-bold tracking-caption uppercase text-paper">
          <span>SAFE</span>
          <span className="text-[9px] text-paper/70">✦</span>
          <span>SECURE</span>
          <span className="text-[9px] text-paper/70">✦</span>
          <span>INSTANT</span>
        </div>

        {/* Right action: Search */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search"
            className="size-10 flex items-center justify-center rounded-xl bg-paper/20 border border-paper/30 text-paper hover:bg-paper/30 active:translate-y-px transition-all"
          >
            <Search className="size-5 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </header>
  );
};
