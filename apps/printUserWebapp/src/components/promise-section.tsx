'use client';

import React from 'react';
import { ShieldCheck, Lock, EyeOff } from 'lucide-react';
import { TapeRollIcon, PolaroidPhoto, PromiseUnderline } from './illustrations/craft-accents';

export const PromiseSection: React.FC = () => {
  return (
    <section className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-6 relative select-none">
      {/* Centered Heading */}
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <h3 className="font-heading text-heading-sm sm:text-heading uppercase tracking-heading-sm text-midnight">
          WE PROMISE
        </h3>
        <div className="mt-1">
          <PromiseUnderline />
        </div>
      </div>

      {/* Decorative Accents Container */}
      <div className="relative max-w-4xl mx-auto">
        {/* Tape roll accent */}
        <div className="absolute -left-2 -bottom-3 z-20 pointer-events-none transform rotate-12 scale-90 sm:scale-100 hidden sm:block">
          <TapeRollIcon className="w-11 h-11" />
        </div>

        {/* Polaroid photo accent floating on the right */}
        <div className="absolute -right-3 -top-6 z-20 pointer-events-none transform rotate-12 scale-90 sm:scale-100 hidden sm:block">
          <PolaroidPhoto className="w-14 h-18" />
        </div>

        {/* Sticky Notes Grid: 1 column on mobile, 3 columns on tablet/desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 relative z-10">
          {/* Note 1: Safety */}
          <div className="relative bg-[#fff07c] text-midnight p-5 rounded-xl border-2 border-midnight/20 transform sm:-rotate-1 hover:rotate-0 transition-transform flex flex-col justify-between min-h-[140px]">
            {/* Tape strip top */}
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-12 h-4 bg-paper/60 rounded-sm border border-midnight/20 -rotate-2" />

            <div>
              <div className="size-8 rounded-lg bg-midnight/10 flex items-center justify-center mb-3 text-midnight">
                <ShieldCheck className="size-4.5 stroke-[2.5]" />
              </div>
              <h4 className="font-heading text-[16px] sm:text-[17px] text-midnight leading-tight">
                Safety
              </h4>
              <p className="mt-1.5 text-caption sm:text-body leading-snug font-medium text-midnight/90">
                Documents are deleted once printed!
              </p>
            </div>
          </div>

          {/* Note 2: Security */}
          <div className="relative bg-[#fff07c] text-midnight p-5 rounded-xl border-2 border-midnight/20 transform sm:rotate-1 hover:rotate-0 transition-transform flex flex-col justify-between min-h-[140px]">
            {/* Tape strip top */}
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-12 h-4 bg-paper/60 rounded-sm border border-midnight/20 rotate-2" />

            <div>
              <div className="size-8 rounded-lg bg-midnight/10 flex items-center justify-center mb-3 text-midnight">
                <Lock className="size-4.5 stroke-[2.5]" />
              </div>
              <h4 className="font-heading text-[16px] sm:text-[17px] text-midnight leading-tight">
                Security
              </h4>
              <p className="mt-1.5 text-caption sm:text-body leading-snug font-medium text-midnight/90">
                Prints are sealed before pickup
              </p>
            </div>
          </div>

          {/* Note 3: No Peek Policy */}
          <div className="relative bg-[#fff07c] text-midnight p-5 rounded-xl border-2 border-midnight/20 transform sm:-rotate-0.5 hover:rotate-0 transition-transform sm:col-span-2 md:col-span-1 flex flex-col justify-between min-h-[140px]">
            {/* Tape strip top */}
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-12 h-4 bg-paper/60 rounded-sm border border-midnight/20 -rotate-1" />

            <div>
              <div className="size-8 rounded-lg bg-midnight/10 flex items-center justify-center mb-3 text-midnight">
                <EyeOff className="size-4.5 stroke-[2.5]" />
              </div>
              <h4 className="font-heading text-[16px] sm:text-[17px] text-midnight leading-tight">
                No Peek Policy
              </h4>
              <p className="mt-1.5 text-caption sm:text-body leading-snug font-medium text-midnight/90">
                Our staff will not look at your Documents
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
