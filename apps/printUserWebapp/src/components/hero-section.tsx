"use client"

import React from "react"

interface HeroSectionProps {
  isAvailable?: boolean
  shopName?: string
  stickerText?: string
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isAvailable = true,
  stickerText = "Print it. Pick it. Done.",
}) => {
  return (
    <div className="relative min-h-[340px] w-full overflow-hidden bg-paper select-none sm:min-h-[420px] md:min-h-[480px] lg:min-h-[520px]">
      {/* 1. Fluid Background image: spans full viewport width */}
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full">
        <img
          src="/assets/hero-bg.png"
          alt=""
          className="block h-full w-full object-cover object-top"
        />
      </div>

      {/* 2. Hero Content Container */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 pt-3 pb-8 text-center sm:px-6 sm:pt-5 md:pt-8 lg:px-8">
        {/* Brand Title: CtrlP */}
        <h1 className="font-heading text-[52px] leading-none tracking-[-0.02em] text-paper drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)] select-none sm:text-[64px] md:text-[76px] lg:text-[86px]">
          CtrlP
        </h1>

        {/* Playful Sticker */}
        <div className="relative mt-2.5 inline-block sm:mt-3">
          <div className="rotate-[3deg] transform cursor-default transition-transform hover:rotate-0">
            <span className="inline-flex items-center justify-center rounded-xl border border-[#eab308]/70 bg-[#fde047] px-4 py-1 text-caption font-bold text-midnight shadow-xs select-none sm:px-5 sm:py-1.5 sm:text-body">
              {isAvailable ? stickerText : "Back soon"}
            </span>
          </div>
        </div>

        {/* 3. Scalable Printer & Scissors Stage */}
        <div className="relative mt-4 flex h-[175px] w-full max-w-[340px] items-center justify-center sm:mt-6 sm:h-[220px] sm:max-w-[440px] md:h-[260px] md:max-w-[520px] lg:h-[300px] lg:max-w-[600px]">
          {/* Covered Printer Image */}
          <div className="relative z-10 w-[265px] sm:w-[340px] md:w-[410px] lg:w-[470px]">
            <img
              src="/assets/printer.png"
              alt="CtrlP Printer"
              className="pointer-events-none h-auto w-full object-contain drop-shadow-[0_8px_18px_rgba(4,44,96,0.16)]"
            />
          </div>

          {/* Blue Scissors with Orange paper note on bottom-left */}
          <div className="pointer-events-none absolute bottom-1 left-1 z-20 w-[96px] sm:bottom-2 sm:left-3 sm:w-[125px] md:left-4 md:w-[150px] lg:w-[170px]">
            <img
              src="/assets/scissors.png"
              alt="Craft scissors"
              className="h-auto w-full -rotate-6 transform object-contain drop-shadow-xs"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
