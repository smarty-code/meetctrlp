import React from "react"
import { siteCopy } from "@/content/copy"

export type PhoneScreenState = "review" | "upload" | "track"

interface PhoneConceptProps {
  screen: PhoneScreenState
  className?: string
  isPressed?: boolean
}

export function PhoneConcept({ screen, className = "", isPressed = false }: PhoneConceptProps) {
  const { conceptData } = siteCopy

  return (
    <figure
      className={`relative w-[280px] h-[570px] bg-ink rounded-[40px] p-2 shadow-card select-none shrink-0 ${className}`}
      aria-label={`Phone concept showing ${screen} screen`}
    >
      <figcaption className="sr-only">Concept preview, not a live screenshot.</figcaption>

      {/* Screen container */}
      <div className="relative w-full h-full bg-surface rounded-[32px] overflow-hidden flex flex-col font-sans text-ink">
        {/* Notch / Speaker bar */}
        <div className="w-full pt-3 pb-2 flex items-center justify-center">
          <div className="w-20 h-4 bg-ink rounded-full" />
        </div>

        {/* Status Bar */}
        <div className="px-5 pb-1 flex justify-between items-center text-[10px] font-bold text-ink-faint tracking-wider">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2 bg-ink/70 rounded-xs" />
            <span className="w-2.5 h-2 bg-ink/70 rounded-xs" />
            <span className="w-4 h-2.5 border border-ink/70 rounded-xs relative">
              <span className="absolute inset-0.5 bg-ink/70 rounded-[1px]" />
            </span>
          </div>
        </div>

        {/* SCREEN 1: REVIEW (Used in Hero) */}
        {screen === "review" && (
          <div className="flex-1 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <span className="text-xs font-semibold text-ink-faint tracking-wider uppercase">
                  Order Details
                </span>
                <span className="text-[10px] font-medium bg-surface-sunken px-2 py-0.5 rounded-full text-ink-soft">
                  {conceptData.sampleDataCaption}
                </span>
              </div>
              <h4 className="text-base font-bold text-ink mt-2">Review order</h4>

              {/* Doc 1 */}
              <div className="mt-3 p-2.5 rounded-xl bg-surface-sunken border border-line">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-ink truncate max-w-[150px]">
                      {conceptData.order1.doc1.name}
                    </p>
                    <p className="text-[10px] text-ink-soft mt-0.5">
                      3 pages · Colour · 1 copy · A4
                    </p>
                  </div>
                  <span className="text-xs font-bold text-ink">
                    {conceptData.order1.doc1.price}
                  </span>
                </div>
              </div>

              {/* Doc 2 */}
              <div className="mt-2 p-2.5 rounded-xl bg-surface-sunken border border-line">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-ink truncate max-w-[150px]">
                      {conceptData.order1.doc2.name}
                    </p>
                    <p className="text-[10px] text-ink-soft mt-0.5">
                      4 pages · B&W · 2 copies · A4
                    </p>
                  </div>
                  <span className="text-xs font-bold text-ink">
                    {conceptData.order1.doc2.price}
                  </span>
                </div>
              </div>

              {/* Cost summary */}
              <div className="mt-4 pt-3 border-t border-line space-y-1 text-xs">
                <div className="flex justify-between text-ink-soft text-[11px]">
                  <span>Resume.pdf</span>
                  <span>{conceptData.order1.doc1.price}</span>
                </div>
                <div className="flex justify-between text-ink-soft text-[11px]">
                  <span>Marksheet.pdf</span>
                  <span>{conceptData.order1.doc2.price}</span>
                </div>
                <div className="flex justify-between font-bold text-ink pt-2 border-t border-line text-sm">
                  <span>Total</span>
                  <span>{conceptData.order1.total}</span>
                </div>
              </div>
            </div>

            {/* Bottom button */}
            <div className="pt-2 text-center">
              <button
                type="button"
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-lime text-ink border border-lime shadow-xs transition-transform duration-150 ${
                  isPressed ? "scale-95 brightness-95" : ""
                }`}
              >
                Confirm & Pay
              </button>
              <p className="text-[10px] text-ink-faint mt-2">Pay at shop</p>
            </div>
          </div>
        )}

        {/* SCREEN 2: UPLOAD (Used in Step 01 & Door A) */}
        {screen === "upload" && (
          <div className="flex-1 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <span className="text-xs font-bold text-ink">Your documents</span>
                <span className="text-[10px] text-lime-deep font-semibold">+ Add file</span>
              </div>

              {/* Uploaded Card */}
              <div className="mt-3 p-3 rounded-xl bg-surface-sunken border border-line flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-ink truncate max-w-[150px]">
                    {conceptData.order1.doc1.name}
                  </p>
                  <p className="text-[10px] text-ink-faint">
                    3 pages · {conceptData.order1.doc1.size}
                  </p>
                </div>
                <button
                  type="button"
                  className="w-5 h-5 rounded-full bg-line flex items-center justify-center text-xs text-ink-soft hover:text-ink"
                  aria-label="Remove document"
                >
                  ×
                </button>
              </div>

              {/* Settings Controls */}
              <div className="mt-4 space-y-3">
                {/* Color toggle */}
                <div>
                  <span className="text-[10px] font-semibold text-ink-soft uppercase block mb-1">
                    Print Color
                  </span>
                  <div className="grid grid-cols-2 p-0.5 bg-surface-sunken rounded-lg border border-line text-[11px] font-medium text-center">
                    <span className="py-1 bg-surface rounded-md shadow-xs text-ink font-bold">
                      Colour
                    </span>
                    <span className="py-1 text-ink-soft">B&W</span>
                  </div>
                </div>

                {/* Copies Stepper */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink font-medium">Copies</span>
                  <div className="flex items-center gap-2 bg-surface-sunken px-2 py-1 rounded-lg border border-line text-xs font-bold">
                    <span className="cursor-pointer text-ink-soft">−</span>
                    <span>1</span>
                    <span className="cursor-pointer text-ink-soft">+</span>
                  </div>
                </div>

                {/* Paper & Pages */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink font-medium">Paper Size</span>
                  <span className="font-bold text-ink bg-surface-sunken px-2 py-0.5 rounded border border-line">
                    A4
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink font-medium">Pages</span>
                  <span className="text-ink-soft text-[11px]">All pages</span>
                </div>
              </div>
            </div>

            {/* Continue button */}
            <div className="pt-2">
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-lime text-ink shadow-xs"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: TRACK (Used in Step 03) */}
        {screen === "track" && (
          <div className="flex-1 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <span className="text-xs font-bold text-ink">
                  Order {conceptData.order1.id}
                </span>
                <span className="text-[10px] font-semibold bg-chip-paid-bg text-chip-paid-fg px-2 py-0.5 rounded-full border border-chip-paid-fg/20">
                  {conceptData.order1.statusPaid}
                </span>
              </div>

              {/* Progress checklist */}
              <div className="mt-6 space-y-4 text-xs font-medium pl-1">
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-lime text-ink flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                  <span className="text-ink-soft">Order submitted</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-lime text-ink flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                  <span className="text-ink-soft">Shop accepted</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-lime text-ink flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                  <span className="text-ink-soft">Printing</span>
                </div>

                <div className="flex items-center gap-3 font-bold text-ink">
                  <span className="w-5 h-5 rounded-full bg-lime text-ink flex items-center justify-center text-xs animate-pulse">
                    ●
                  </span>
                  <span>Ready for pickup</span>
                </div>

                <div className="flex items-center gap-3 text-ink-faint">
                  <span className="w-5 h-5 rounded-full border border-line flex items-center justify-center text-xs">
                    ○
                  </span>
                  <span>Completed</span>
                </div>
              </div>
            </div>

            {/* Shop location footer */}
            <div className="p-2.5 rounded-xl bg-surface-sunken border border-line text-[11px] text-center text-ink-soft">
              Show order ID <span className="font-bold text-ink">{conceptData.order1.id}</span> at the counter
            </div>
          </div>
        )}
      </div>
    </figure>
  )
}
