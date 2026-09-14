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
    <div className="relative w-full overflow-hidden select-none bg-[#0283fd] md:bg-gradient-to-b md:from-[#0283fd] md:via-[#0283fd] md:to-paper min-h-[320px] sm:min-h-[380px] md:min-h-[460px] lg:min-h-[500px]">
      {/* 1. Mobile Background Image: completely fitted across width so no papers or elements are cropped */}
      <div className="md:hidden absolute inset-x-0 bottom-0 w-full pointer-events-none z-0">
        <img
          src="/assets/hero-bg.png"
          alt=""
          className="w-full h-auto object-contain object-bottom block"
        />
      </div>

      {/* 2. Desktop Background Image (screens above tablet): wide panoramic artwork */}
      <div className="hidden md:block absolute inset-0 w-full h-full pointer-events-none z-0">
        <img
          src="/assets/hero-bg-desktop.png"
          alt=""
          className="w-full h-full object-cover object-bottom block"
        />
      </div>

      {/* 3. Hero Content Container */}
      <div className="relative z-10 w-full max-w-[1200px] mx-auto flex flex-col items-center pt-2 sm:pt-4 md:pt-6 pb-6 px-4 sm:px-6 lg:px-8 text-center">
        {/* Brand Title: CtrlP */}
        <h1 className="font-heading text-[48px] sm:text-[60px] md:text-[72px] lg:text-[84px] text-paper tracking-[-0.02em] leading-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.18)]">
          CtrlP
        </h1>

        {/* Playful Sticker */}
        <div className="relative mt-2 sm:mt-2.5 inline-block">
          <div className="transform rotate-[3deg] hover:rotate-0 transition-transform cursor-default">
            <span className="inline-flex items-center justify-center px-3.5 py-1 sm:px-5 sm:py-1.5 rounded-xl text-caption sm:text-body font-bold text-midnight bg-[#fde047] border border-[#eab308]/70 shadow-xs select-none">
              {isAvailable ? stickerText : 'Back soon'}
            </span>
          </div>
        </div>

        {/* 4. Scalable Printer & Scissors Stage */}
        <div className="relative w-full max-w-[320px] sm:max-w-[420px] md:max-w-[500px] lg:max-w-[580px] h-[160px] sm:h-[200px] md:h-[240px] lg:h-[280px] mt-3 sm:mt-4 md:mt-6 flex items-center justify-center">
          {/* Covered Printer Image */}
          <div className="relative z-10 w-[245px] sm:w-[320px] md:w-[390px] lg:w-[450px]">
            <img
              src="/assets/printer.png"
              alt="CtrlP Printer"
              className="w-full h-auto object-contain pointer-events-none drop-shadow-[0_8px_18px_rgba(4,44,96,0.16)]"
            />
          </div>

          {/* Blue Scissors with Orange paper note on bottom-left */}
          <div className="absolute left-0 sm:left-2 md:left-3 bottom-0 sm:bottom-1 z-20 w-[90px] sm:w-[115px] md:w-[140px] lg:w-[160px] pointer-events-none">
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
