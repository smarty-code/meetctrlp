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
    <div className="relative w-full overflow-hidden select-none bg-paper">
      {/* 1. Background image: Blue gradient, floating papers, and curved horizon */}
      <div className="absolute top-0 inset-x-0 w-full pointer-events-none z-0">
        <img
          src="/assets/hero-bg.png"
          alt=""
          className="w-full h-auto object-cover object-top block"
        />
      </div>

      {/* 2. Hero Content */}
      <div className="relative z-10 flex flex-col items-center pt-2 pb-5 px-4 text-center">
        {/* Brand Title: CtrlP */}
        <h1 className="font-heading text-[52px] sm:text-[58px] text-paper tracking-[-0.02em] leading-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
          CtrlP
        </h1>

        {/* Playful Sticker */}
        <div className="relative mt-2 inline-block">
          <div className="transform rotate-[3deg] hover:rotate-0 transition-transform cursor-default">
            <span className="inline-flex items-center justify-center px-4 py-1 rounded-xl text-caption font-bold text-midnight bg-[#fde047] border border-[#eab308]/60 shadow-xs select-none">
              {isAvailable ? stickerText : 'Back soon'}
            </span>
          </div>
        </div>

        {/* 3. Printer & Scissors Stage */}
        <div className="relative w-full max-w-[340px] h-[175px] sm:h-[185px] mt-2 flex items-center justify-center">
          {/* Covered Printer Image */}
          <div className="relative z-10 w-[265px] sm:w-[285px]">
            <img
              src="/assets/printer.png"
              alt="CtrlP Printer"
              className="w-full h-auto object-contain pointer-events-none drop-shadow-[0_6px_14px_rgba(4,44,96,0.12)]"
            />
          </div>

          {/* Blue Scissors with Orange paper note on bottom-left */}
          <div className="absolute left-2 bottom-2 z-20 w-[96px] sm:w-[106px] pointer-events-none">
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
