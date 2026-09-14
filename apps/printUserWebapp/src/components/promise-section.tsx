'use client';

import React from 'react';
import { ShieldCheck, Lock, EyeOff } from 'lucide-react';
import {
  BlueScissorIcon,
  TapeRollIcon,
  PolaroidPhoto,
  SparkleRays,
  CurledCorner,
  PromiseUnderline,
} from './illustrations/craft-accents';

export const PromiseSection: React.FC = () => {
  return (
    <section className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-8 relative select-none">
      {/* Centered Heading */}
      <div className="flex flex-col items-center justify-center text-center mb-6 sm:mb-8">
        <h3 className="font-heading text-heading-sm sm:text-heading uppercase tracking-heading-sm text-midnight font-black">
          WE PROMISE
        </h3>
        <div className="mt-1">
          <PromiseUnderline />
        </div>
      </div>

      {/* Playful Craft Cards Container */}
      <div className="relative max-w-[360px] sm:max-w-[460px] md:max-w-[520px] mx-auto">
        {/* Top Row: 2 Sticky Notes Side-by-Side */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 relative z-10">
          {/* Card 1: Safety */}
          <div className="relative bg-[#fef08a] text-midnight p-3.5 sm:p-5 rounded-xl border border-amber-300/70 shadow-xs flex flex-col justify-between min-h-[140px] sm:min-h-[155px] transform hover:-rotate-1 transition-transform">
            {/* Peach tape strip on top-right corner */}
            <div className="absolute -top-1.5 -right-1 w-7 sm:w-8 h-3.5 bg-[#f6ad7b] rounded-xs rotate-12 shadow-xs pointer-events-none" />

            {/* Dog-ear curled corner on bottom-right */}
            <CurledCorner className="w-7 h-7 sm:w-8 sm:h-8" />

            <div>
              <div className="size-7 sm:size-8 rounded-full bg-amber-400/30 border border-amber-500/25 flex items-center justify-center text-amber-950 mb-2 sm:mb-3">
                <ShieldCheck className="size-4 sm:size-4.5 stroke-[2.5]" />
              </div>
              <h4 className="font-heading font-bold text-[15px] sm:text-[17px] text-midnight leading-tight">
                Safety
              </h4>
              <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-[12.5px] leading-snug font-medium text-midnight/85">
                Documents are deleted once printed!
              </p>
            </div>
          </div>

          {/* Card 2: Security */}
          <div className="relative bg-[#fef08a] text-midnight p-3.5 sm:p-5 rounded-xl border border-amber-300/70 shadow-xs flex flex-col justify-between min-h-[140px] sm:min-h-[155px] transform hover:rotate-1 transition-transform">
            <div>
              <div className="size-7 sm:size-8 rounded-full bg-amber-400/30 border border-amber-500/25 flex items-center justify-center text-amber-950 mb-2 sm:mb-3">
                <Lock className="size-4 sm:size-4.5 stroke-[2.5]" />
              </div>
              <h4 className="font-heading font-bold text-[15px] sm:text-[17px] text-midnight leading-tight">
                Security
              </h4>
              <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-[12.5px] leading-snug font-medium text-midnight/85">
                Prints are sealed before delivery
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Row: Wide Horizontal Sticky Note with Craft Accents */}
        <div className="relative mt-4 sm:mt-5">
          {/* Blue Craft Scissors overlapping on left */}
          <div className="absolute -left-6 sm:-left-9 -top-8 sm:-top-9 z-20 pointer-events-none transform -rotate-6">
            <BlueScissorIcon className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-xs" />
          </div>

          {/* Tape Roll Accent on bottom-left */}
          <div className="absolute -left-5 sm:-left-8 bottom-0 z-20 pointer-events-none transform rotate-12">
            <TapeRollIcon className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-xs" />
          </div>

          {/* Polaroid Photo Accent on top-right */}
          <div className="absolute -right-3 sm:-right-5 -top-8 sm:-top-10 z-20 pointer-events-none transform rotate-12">
            <PolaroidPhoto className="w-13 h-16 sm:w-16 sm:h-20 drop-shadow-xs" />
          </div>

          {/* Sparkle burst rays on bottom-right */}
          <div className="absolute -right-3 -bottom-3 z-20 pointer-events-none">
            <SparkleRays className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>

          {/* Card 3: No Peek Policy */}
          <div className="relative z-10 w-full bg-[#fef08a] text-midnight p-4 sm:p-5 rounded-xl border border-amber-300/70 shadow-xs transform -rotate-2 sm:-rotate-2.5 hover:rotate-0 transition-transform">
            <div className="flex items-start gap-3 sm:gap-3.5">
              <div className="size-8 sm:size-9 rounded-full bg-amber-400/30 border border-amber-500/25 flex items-center justify-center text-amber-950 shrink-0 mt-0.5">
                <EyeOff className="size-4.5 sm:size-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <h4 className="font-heading font-bold text-[15.5px] sm:text-[18px] text-midnight leading-tight">
                  No Peek Policy
                </h4>
                <p className="mt-1 text-[11.5px] sm:text-[13.5px] leading-snug font-medium text-midnight/85">
                  Our staff will not look at your Documents
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
