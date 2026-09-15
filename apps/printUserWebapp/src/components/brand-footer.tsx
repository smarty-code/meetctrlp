"use client"

import React from "react"
import { CtrlPKeypadIllustration } from "./illustrations/ctrl-p-keypad-illustration"

export const BrandFooter: React.FC = () => {
  return (
    <footer className="relative w-full overflow-hidden bg-paper pt-10 pb-8 text-center select-none sm:pt-14 sm:pb-12">
      {/* Light Notebook Grid Texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(#3c3c3c 1px, transparent 1px), radial-gradient(#3c3c3c 1px, #ffffff 1px)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 10px 10px",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        {/* Keypad illustration */}
        <div className="scale-95 transform sm:scale-105 md:scale-110">
          <CtrlPKeypadIllustration />
        </div>

        {/* Headline */}
        <h4 className="mt-4 font-heading text-heading leading-heading tracking-heading text-midnight sm:text-[36px] md:text-[42px]">
          Certain things <br />
          <span className="text-ecto-green">deserve paper!</span>
        </h4>

        {/* Brand note */}
        <p className="mt-2 flex items-center justify-center gap-1.5 text-caption font-bold text-ash sm:text-body">
          <span className="text-macaw-blue">💙</span>
          <span>Perfect it with CtrlP</span>
        </p>
      </div>
    </footer>
  )
}
