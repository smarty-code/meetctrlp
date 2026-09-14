'use client';

import React from 'react';
import { ShieldCheck, Lock, EyeOff } from 'lucide-react';
import { TapeRollIcon, PolaroidPhoto, PromiseUnderline } from './illustrations/craft-accents';

export const PromiseSection: React.FC = () => {
  return (
    <section className="w-full px-4 pt-8 pb-4 relative select-none">
      {/* Centered Heading */}
      <div className="flex flex-col items-center justify-center text-center mb-6">
        <h3 className="font-heading text-heading-sm uppercase tracking-heading-sm text-midnight">
          WE PROMISE
        </h3>
        <div className="mt-1">
          <PromiseUnderline />
        </div>
      </div>

      {/* Decorative Accents Floating */}
      <div className="relative max-w-[360px] mx-auto">
        {/* Blue craft scissors from assets */}
        {/* <div className="absolute -left-5 top-27 z-20 pointer-events-none w-22">
          <img
            src="/assets/scissors.png"
            alt=""
            className="w-full h-auto object-contain transform -rotate-12 drop-shadow-xs"
          />
        </div> */}

        {/* Tape roll accent */}
        <div className="absolute -left-1 bottom-1 z-20 pointer-events-none transform rotate-12 scale-90">
          <TapeRollIcon className="w-11 h-11" />
        </div>

        {/* Polaroid photo accent floating on the right */}
        <div className="absolute -right-2 top-32 z-20 pointer-events-none transform rotate-12 scale-90">
          <PolaroidPhoto className="w-14 h-18" />
        </div>

        {/* Sticky Notes Grid (12px radius, flat 2px border, no drop shadows) */}
        <div className="flex flex-col gap-3 relative z-10">
          {/* Top Two Sticky Notes */}
          <div className="grid grid-cols-2 gap-3">
            {/* Note 1: Safety */}
            <div className="relative bg-[#fff07c] text-midnight p-4 rounded-xl border-2 border-midnight/20 transform -rotate-1 hover:rotate-0 transition-transform">
              {/* Tape strip top */}
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-10 h-4 bg-paper/60 rounded-sm border border-midnight/20 -rotate-2" />

              <div className="size-7 rounded-lg bg-midnight/10 flex items-center justify-center mb-2 text-midnight">
                <ShieldCheck className="size-4 stroke-[2.5]" />
              </div>
              <h4 className="font-heading text-[15px] text-midnight leading-tight">
                Safety
              </h4>
              <p className="mt-1 text-caption leading-snug font-medium text-midnight/90">
                Documents are deleted once printed!
              </p>
            </div>

            {/* Note 2: Security */}
            <div className="relative bg-[#fff07c] text-midnight p-4 rounded-xl border-2 border-midnight/20 transform rotate-1 hover:rotate-0 transition-transform">
              {/* Tape strip top */}
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-10 h-4 bg-paper/60 rounded-sm border border-midnight/20 rotate-2" />

              <div className="size-7 rounded-lg bg-midnight/10 flex items-center justify-center mb-2 text-midnight">
                <Lock className="size-4 stroke-[2.5]" />
              </div>
              <h4 className="font-heading text-[15px] text-midnight leading-tight">
                Security
              </h4>
              <p className="mt-1 text-caption leading-snug font-medium text-midnight/90">
                Prints are sealed before pickup
              </p>
            </div>
          </div>

          {/* Bottom Sticky Note: No Peek Policy */}
          <div className="relative bg-[#fff07c] text-midnight p-4 rounded-xl border-2 border-midnight/20 ml-8 mr-2 transform -rotate-0.5 hover:rotate-0 transition-transform">
            <div className="flex items-start gap-3">
              <div className="size-7 rounded-lg bg-midnight/10 flex items-center justify-center shrink-0 mt-0.5 text-midnight">
                <EyeOff className="size-4 stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-heading text-[15px] text-midnight leading-tight">
                  No Peek Policy
                </h4>
                <p className="mt-1 text-caption leading-snug font-medium text-midnight/90">
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
