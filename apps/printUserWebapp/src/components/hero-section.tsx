'use client';

import React from 'react';

interface HeroSectionProps {
  isAvailable?: boolean;
  shopName?: string;
  stickerText?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  isAvailable = true,
  stickerText = 'Print it. Pick it. Done.',
}) => {
  return (
    <div className="relative w-full overflow-hidden select-none bg-paper min-h-[340px] sm:min-h-[420px] md:min-h-[480px] lg:min-h-[520px]">
      {/* 1. Fluid Background image: spans full viewport width */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <img
          src="/assets/hero-bg.png"
          alt=""
          className="w-full h-full object-cover object-top block"
        />
      </div>

      {/* 2. Hero Content Container */}
      <div className="relative z-10 w-full max-w-[1200px] mx-auto flex flex-col items-center pt-3 sm:pt-5 md:pt-8 pb-8 px-4 sm:px-6 lg:px-8 text-center">
        {/* Brand Title: CtrlP */}
        <h1 className="font-heading text-[52px] sm:text-[64px] md:text-[76px] lg:text-[86px] text-paper tracking-[-0.02em] leading-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
          CtrlP
        </h1>

        {/* Playful Sticker */}
        <div className="relative mt-2.5 sm:mt-3 inline-block">
          <div className="transform rotate-[3deg] hover:rotate-0 transition-transform cursor-default">
            <span className="inline-flex items-center justify-center px-4 py-1 sm:px-5 sm:py-1.5 rounded-xl text-caption sm:text-body font-bold text-midnight bg-[#fde047] border border-[#eab308]/70 shadow-xs select-none">
              {isAvailable ? stickerText : 'Back soon'}
            </span>
          </div>
        </div>

        {/* 3. Scalable Printer & Scissors Stage */}
        <div className="relative w-full max-w-[340px] sm:max-w-[440px] md:max-w-[520px] lg:max-w-[600px] h-[175px] sm:h-[220px] md:h-[260px] lg:h-[300px] mt-4 sm:mt-6 flex items-center justify-center">
          {/* Covered Printer Image */}
          <div className="relative z-10 w-[265px] sm:w-[340px] md:w-[410px] lg:w-[470px]">
            <img
              src="/assets/printer.png"
              alt="CtrlP Printer"
              className="w-full h-auto object-contain pointer-events-none drop-shadow-[0_8px_18px_rgba(4,44,96,0.16)]"
            />
          </div>

          {/* Blue Scissors with Orange paper note on bottom-left */}
          <div className="absolute left-1 sm:left-3 md:left-4 bottom-1 sm:bottom-2 z-20 w-[96px] sm:w-[125px] md:w-[150px] lg:w-[170px] pointer-events-none">
            <img
              src="/assets/scissors.png"
              alt="Craft scissors"
              className="w-full h-auto object-contain transform -rotate-6 drop-shadow-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
