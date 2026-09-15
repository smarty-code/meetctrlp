"use client"

import React from "react"
import { ShieldCheck, Lock, EyeOff } from "lucide-react"
import {
  BlueScissorIcon,
  TapeRollIcon,
  PolaroidPhoto,
  SparkleRays,
  CurledCorner,
  PromiseUnderline,
} from "./illustrations/craft-accents"

export const PromiseSection: React.FC = () => {
  return (
    <section className="relative mx-auto w-full max-w-[1200px] px-4 pt-10 pb-8 select-none sm:px-6 sm:pt-14 lg:px-8">
      {/* Centered Heading */}
      <div className="mb-6 flex flex-col items-center justify-center text-center sm:mb-8">
        <h3 className="font-heading text-heading-sm font-black tracking-heading-sm text-midnight uppercase sm:text-heading">
          WE PROMISE
        </h3>
        <div className="mt-1">
          <PromiseUnderline />
        </div>
      </div>

      {/* Playful Craft Cards Container */}
      <div className="relative mx-auto max-w-[360px] sm:max-w-[460px] md:max-w-[520px]">
        {/* Top Row: 2 Sticky Notes Side-by-Side */}
        <div className="relative z-10 grid grid-cols-2 gap-3 sm:gap-4">
          {/* Card 1: Safety */}
          <div className="relative flex min-h-[140px] transform flex-col justify-between rounded-xl border border-amber-300/70 bg-[#fef08a] p-3.5 text-midnight shadow-xs transition-transform hover:-rotate-1 sm:min-h-[155px] sm:p-5">
            {/* Peach tape strip on top-right corner */}
            <div className="pointer-events-none absolute -top-1.5 -right-1 h-3.5 w-7 rotate-12 rounded-xs bg-[#f6ad7b] shadow-xs sm:w-8" />

            {/* Dog-ear curled corner on bottom-right */}
            <CurledCorner className="h-7 w-7 sm:h-8 sm:w-8" />

            <div>
              <div className="mb-2 flex size-7 items-center justify-center rounded-full border border-amber-500/25 bg-amber-400/30 text-amber-950 sm:mb-3 sm:size-8">
                <ShieldCheck className="size-4 stroke-[2.5] sm:size-4.5" />
              </div>
              <h4 className="font-heading text-[15px] leading-tight font-bold text-midnight sm:text-[17px]">
                Safety
              </h4>
              <p className="mt-1 text-[11px] leading-snug font-medium text-midnight/85 sm:mt-1.5 sm:text-[12.5px]">
                Documents are deleted once printed!
              </p>
            </div>
          </div>

          {/* Card 2: Security */}
          <div className="relative flex min-h-[140px] transform flex-col justify-between rounded-xl border border-amber-300/70 bg-[#fef08a] p-3.5 text-midnight shadow-xs transition-transform hover:rotate-1 sm:min-h-[155px] sm:p-5">
            <div>
              <div className="mb-2 flex size-7 items-center justify-center rounded-full border border-amber-500/25 bg-amber-400/30 text-amber-950 sm:mb-3 sm:size-8">
                <Lock className="size-4 stroke-[2.5] sm:size-4.5" />
              </div>
              <h4 className="font-heading text-[15px] leading-tight font-bold text-midnight sm:text-[17px]">
                Security
              </h4>
              <p className="mt-1 text-[11px] leading-snug font-medium text-midnight/85 sm:mt-1.5 sm:text-[12.5px]">
                Prints are sealed before delivery
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Row: Wide Horizontal Sticky Note with Craft Accents */}
        <div className="relative mt-4 sm:mt-5">
          {/* Blue Craft Scissors overlapping on left */}
          <div className="pointer-events-none absolute -top-8 -left-6 z-20 -rotate-6 transform sm:-top-9 sm:-left-9">
            <BlueScissorIcon className="h-16 w-16 drop-shadow-xs sm:h-20 sm:w-20" />
          </div>

          {/* Tape Roll Accent on bottom-left */}
          <div className="pointer-events-none absolute bottom-0 -left-5 z-20 rotate-12 transform sm:-left-8">
            <TapeRollIcon className="h-10 w-10 drop-shadow-xs sm:h-12 sm:w-12" />
          </div>

          {/* Polaroid Photo Accent on top-right */}
          <div className="pointer-events-none absolute -top-8 -right-3 z-20 rotate-12 transform sm:-top-10 sm:-right-5">
            <PolaroidPhoto className="h-16 w-13 drop-shadow-xs sm:h-20 sm:w-16" />
          </div>

          {/* Sparkle burst rays on bottom-right */}
          <div className="pointer-events-none absolute -right-3 -bottom-3 z-20">
            <SparkleRays className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>

          {/* Card 3: No Peek Policy */}
          <div className="sm:-rotate-2.5 relative z-10 w-full -rotate-2 transform rounded-xl border border-amber-300/70 bg-[#fef08a] p-4 text-midnight shadow-xs transition-transform hover:rotate-0 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-3.5">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-amber-500/25 bg-amber-400/30 text-amber-950 sm:size-9">
                <EyeOff className="size-4.5 stroke-[2.5] sm:size-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-heading text-[15.5px] leading-tight font-bold text-midnight sm:text-[18px]">
                  No Peek Policy
                </h4>
                <p className="mt-1 text-[11.5px] leading-snug font-medium text-midnight/85 sm:text-[13.5px]">
                  Our staff will not look at your Documents
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
