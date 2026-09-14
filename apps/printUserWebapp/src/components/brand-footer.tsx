'use client';

import React from 'react';
import { CtrlPKeypadIllustration } from './illustrations/ctrl-p-keypad-illustration';

export const BrandFooter: React.FC = () => {
  return (
    <footer className="w-full relative pt-10 sm:pt-14 pb-8 sm:pb-12 overflow-hidden bg-paper select-none text-center">
      {/* Light Notebook Grid Texture */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(#3c3c3c 1px, transparent 1px), radial-gradient(#3c3c3c 1px, #ffffff 1px)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px',
        }}
      />

      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Keypad illustration */}
        <div className="transform scale-95 sm:scale-105 md:scale-110">
          <CtrlPKeypadIllustration />
        </div>

        {/* Headline */}
        <h4 className="mt-4 font-heading text-heading sm:text-[36px] md:text-[42px] tracking-heading text-midnight leading-heading">
          Certain things <br />
          <span className="text-ecto-green">deserve paper!</span>
        </h4>

        {/* Brand note */}
        <p className="mt-2 text-caption sm:text-body font-bold text-ash flex items-center justify-center gap-1.5">
          <span className="text-macaw-blue">💙</span>
          <span>Perfect it with CtrlP</span>
        </p>
      </div>
    </footer>
  );
};
