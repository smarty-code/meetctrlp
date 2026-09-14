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
    <header className="w-full flex items-center justify-between px-4 pt-3 pb-2 select-none relative z-20 text-paper bg-[#0283fd]">
      {/* Spacer to keep center text balanced */}
      <div className="size-10" />

      {/* Center trust pill */}
      <div className="flex items-center gap-1.5 text-caption font-bold tracking-caption uppercase text-paper">
        <span>SAFE</span>
        <span className="text-[9px] text-paper/70">✦</span>
        <span>SECURE</span>
        <span className="text-[9px] text-paper/70">✦</span>
        <span>INSTANT</span>
      </div>

      {/* Right action: Search only (share and back arrow removed) */}
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
    </header>
  );
};
