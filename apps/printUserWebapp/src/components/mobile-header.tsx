"use client"

import React from "react"
import { Search } from "lucide-react"

interface MobileHeaderProps {
  onSearch?: () => void
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ onSearch }) => {
  return (
    <header className="relative z-20 w-full bg-[#0283fd] text-paper select-none">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Left: Brand tag on desktop, invisible spacer on mobile */}
        <div className="flex items-center gap-2">
          <span className="hidden font-heading text-[22px] font-black tracking-tight text-paper md:inline-block">
            CtrlP
          </span>
          <div className="size-10 md:hidden" />
        </div>

        {/* Center: Trust pill */}
        <div className="flex items-center gap-1.5 text-caption font-bold tracking-caption text-paper uppercase sm:gap-2">
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
            className="flex size-10 items-center justify-center rounded-xl border border-paper/30 bg-paper/20 text-paper transition-all hover:bg-paper/30 active:translate-y-px"
          >
            <Search className="size-5 stroke-[2.2]" />
          </button>
        </div>
      </div>
    </header>
  )
}
