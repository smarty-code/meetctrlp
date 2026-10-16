import React from "react"
import { siteCopy } from "@/content/copy"

export type DesktopScreenState = "queue" | "job"

interface DesktopConceptProps {
  screen: DesktopScreenState
  className?: string
  isAccepted?: boolean
  newOrderIncoming?: boolean
}

export function DesktopConcept({
  screen,
  className = "",
  isAccepted = false,
  newOrderIncoming = false,
}: DesktopConceptProps) {
  const { conceptData } = siteCopy

  return (
    <figure
      className={`relative w-full max-w-[520px] aspect-[16/10] bg-surface rounded-2xl border border-line shadow-card overflow-hidden flex flex-col font-sans text-ink select-none ${className}`}
      aria-label={`Desktop concept showing ${screen} screen`}
    >
      <figcaption className="sr-only">Concept preview, not a live screenshot.</figcaption>

      {/* Desktop Window Title Bar */}
      <div className="h-9 px-3.5 bg-surface-sunken border-b border-line flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
        </div>
        <span className="text-[11px] font-semibold text-ink-soft">
          CtrlP for Print Shops
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-ink-faint">
          <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
          <span className="hidden sm:inline">{conceptData.order1.printer}</span>
        </div>
      </div>

      {/* Window Body: Two Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Orders list */}
        <div className="w-[42%] border-r border-line bg-surface p-2.5 flex flex-col justify-between shrink-0">
          <div>
            <div className="flex items-center justify-between pb-1.5 border-b border-line/60">
              <span className="text-[11px] font-bold text-ink">New orders</span>
              <span className="text-[10px] font-semibold text-ink-faint">2 live</span>
            </div>

            {/* Order 1: Selected */}
            <div
              className={`mt-2 p-2 rounded-lg border text-xs transition-colors duration-300 ${
                newOrderIncoming
                  ? "bg-lime-soft/40 border-lime"
                  : "bg-surface-sunken border-line"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink text-[11px]">
                  {conceptData.order1.id}
                </span>
                <span className="text-[9px] font-bold bg-chip-paid-bg text-chip-paid-fg px-1.5 py-0.5 rounded border border-chip-paid-fg/20">
                  {conceptData.order1.statusPaid}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1 text-[10px] text-ink-soft">
                <span>2 docs · 7 pgs</span>
                <span className="font-semibold text-ink">{conceptData.order1.total}</span>
              </div>
            </div>

            {/* Order 2 */}
            <div className="mt-1.5 p-2 rounded-lg border border-line/60 bg-surface text-xs opacity-80">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink text-[11px]">
                  {conceptData.order2.id}
                </span>
                <span className="text-[9px] font-semibold bg-chip-pending-bg text-chip-pending-fg px-1.5 py-0.5 rounded border border-chip-pending-fg/20">
                  {conceptData.order2.statusPayAtShop}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1 text-[10px] text-ink-soft">
                <span>3 docs</span>
                <span className="font-semibold text-ink">{conceptData.order2.price}</span>
              </div>
            </div>
          </div>

          <div className="text-[9px] text-ink-faint border-t border-line/60 pt-1 text-center">
            {conceptData.sampleDataCaption}
          </div>
        </div>

        {/* Right Column: Screen Specific Detail */}
        <div className="flex-1 bg-surface-sunken p-3 flex flex-col justify-between overflow-hidden">
          {screen === "queue" && (
            <div className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-line pb-1.5">
                  <span className="text-xs font-bold text-ink">Print queue</span>
                  <span className="text-[10px] text-lime-deep font-semibold">Active</span>
                </div>

                <div className="mt-2.5 p-2 rounded-lg bg-surface border border-line">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-ink">
                      {conceptData.order1.id}
                    </span>
                    <span className="text-[10px] font-bold text-lime-deep bg-lime-soft px-2 py-0.5 rounded">
                      {conceptData.order1.statusPrinting}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 w-full bg-surface-sunken rounded-full overflow-hidden border border-line/50">
                    <div className="h-full bg-lime w-2/3 rounded-full animate-pulse" />
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-[10px] text-ink-soft">
                  <p>• {conceptData.order1.doc1.name} (Colour)</p>
                  <p>• {conceptData.order1.doc2.name} (B&W)</p>
                </div>
              </div>

              <div className="text-[10px] text-ink-faint flex items-center justify-between bg-surface p-1.5 rounded border border-line">
                <span>Local Spooler: Ready</span>
                <span className="font-semibold text-ink">Port USB-01</span>
              </div>
            </div>
          )}

          {screen === "job" && (
            <div className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-line pb-1.5">
                  <span className="text-xs font-bold text-ink">Print job details</span>
                  <span className="text-[10px] text-ink-faint">Ready to print</span>
                </div>

                <div className="mt-2 space-y-1.5 text-xs">
                  <div className="p-2 rounded bg-surface border border-line">
                    <span className="text-[10px] text-ink-faint block">Target Printer</span>
                    <span className="font-bold text-ink text-[11px]">
                      Xerox Printer 01 (Connected)
                    </span>
                  </div>

                  <div className="p-2 rounded bg-surface border border-line space-y-0.5">
                    <span className="text-[10px] text-ink-faint block">Specifications</span>
                    <p className="font-medium text-ink text-[11px]">
                      Colour · A4 · 1 copy · All pages
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button / Progress */}
              <div className="pt-2">
                {isAccepted ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-lime-deep">
                      <span>Sending to Printer…</span>
                      <span className="text-[10px] font-semibold bg-lime-soft px-1.5 py-0.5 rounded">
                        Spooling
                      </span>
                    </div>
                    <div className="h-2 w-full bg-surface rounded-full overflow-hidden border border-line">
                      <div className="h-full bg-lime rounded-full w-4/5 transition-all duration-500" />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-lime text-ink border border-lime shadow-xs hover:brightness-95 transition-all"
                  >
                    Accept order
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </figure>
  )
}
