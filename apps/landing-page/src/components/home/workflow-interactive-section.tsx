"use client"

import React, { useState } from "react"
import { siteConfig } from "@/config/site-content"
import {
  QrCode,
  CheckCircle2,
  FileText,
} from "lucide-react"

export function WorkflowInteractiveSection() {
  const [activeStep, setActiveStep] = useState(0)
  const steps = siteConfig.workflow.steps

  return (
    <section id="workflow" className="bg-[#fafbfa] py-20 sm:py-28 border-b border-graphite/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Heading */}
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-ash">
            THE CONNECTED WORKFLOW
          </p>
          <h2 className="mt-3 font-heading text-3xl font-black tracking-tight text-midnight sm:text-5xl">
            {siteConfig.workflow.headline}
          </h2>
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-charcoal font-normal">
            {siteConfig.workflow.supportingCopy}
          </p>
        </div>

        {/* Two-Column Composition: Left Steps List, Right Large Product Visual */}
        <div className="mt-16 grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
          {/* Left Column: 4 Numbered Steps (col 5) */}
          <div className="lg:col-span-5 space-y-3" role="tablist" aria-label="Workflow steps">
            {steps.map((step, idx) => {
              const isSelected = activeStep === idx
              return (
                <button
                  key={step.number}
                  onClick={() => setActiveStep(idx)}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`workflow-panel-${idx}`}
                  className={`w-full text-left rounded-xl p-5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-paper border-2 border-ecto-green shadow-xs"
                      : "bg-paper/70 border border-graphite/15 hover:bg-paper hover:border-graphite/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold ${
                        isSelected ? "text-ecto-green" : "text-ash"
                      }`}
                    >
                      {step.number}
                    </span>
                    {isSelected && (
                      <span className="flex h-2 w-2 rounded-full bg-ecto-green animate-pulse" />
                    )}
                  </div>

                  <h3 className="mt-2 font-heading text-lg font-bold text-midnight">
                    {step.title}
                  </h3>

                  <p className="mt-1.5 text-xs sm:text-sm text-charcoal leading-relaxed">
                    {step.summary}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Right Column: One Large Real Product UI Visual (col 7) */}
          <div
            id={`workflow-panel-${activeStep}`}
            role="tabpanel"
            className="rounded-2xl border border-graphite/20 bg-paper p-6 sm:p-8 lg:col-span-7 shadow-xs"
          >
            {/* Header of Preview */}
            <div className="flex items-center justify-between border-b border-graphite/10 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="rounded-lg bg-eel-light px-2.5 py-1 text-xs font-bold text-midnight">
                  Step {steps[activeStep].number} of 04
                </span>
                <span className="font-heading text-base font-bold text-midnight">
                  {steps[activeStep].title}
                </span>
              </div>
              <span className="text-xs text-ash">
                Simulated Product Preview
              </span>
            </div>

            {/* Dynamic visual matching activeStep */}
            <div className="mt-6">
              {activeStep === 0 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-dashed border-ecto-green bg-green-50/40 p-8 text-center">
                    <QrCode className="h-16 w-16 text-midnight mx-auto" />
                    <p className="mt-3 text-sm font-bold text-midnight">
                      Scan shop counter standee
                    </p>
                    <p className="text-xs text-ash mt-1">
                      Opens Print User page instantly in mobile browser without account creation
                    </p>
                  </div>
                  <div className="rounded-xl border border-graphite/15 p-3.5 bg-gray-50 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-600" />
                      <span className="font-semibold text-midnight">Project_Draft_Final.pdf</span>
                    </div>
                    <span className="text-ash font-mono">14 pages (PDF)</span>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl border border-graphite/15 bg-gray-50 p-4">
                    <p className="font-bold text-midnight text-sm mb-3">
                      Selected Print Specifications
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-paper p-3 border border-graphite/10">
                        <span className="text-ash block text-[11px]">Color Option</span>
                        <span className="font-bold text-midnight text-sm mt-0.5 block">
                          Black &amp; White
                        </span>
                      </div>
                      <div className="rounded-lg bg-paper p-3 border border-graphite/10">
                        <span className="text-ash block text-[11px]">Sides</span>
                        <span className="font-bold text-midnight text-sm mt-0.5 block">
                          Duplex (Double-sided)
                        </span>
                      </div>
                      <div className="rounded-lg bg-paper p-3 border border-graphite/10">
                        <span className="text-ash block text-[11px]">Copies</span>
                        <span className="font-bold text-midnight text-sm mt-0.5 block">
                          1 copy
                        </span>
                      </div>
                      <div className="rounded-lg bg-paper p-3 border border-graphite/10">
                        <span className="text-ash block text-[11px]">Paper Size</span>
                        <span className="font-bold text-midnight text-sm mt-0.5 block">
                          Standard A4
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-graphite/15 bg-gray-50 p-5">
                    <div className="flex items-center justify-between pb-3 border-b border-graphite/10">
                      <div>
                        <p className="font-bold text-midnight text-sm">Order Summary #CP-2084</p>
                        <p className="text-xs text-ash">Corner Print Works • Rate: ₹1.50/page duplex</p>
                      </div>
                      <span className="rounded bg-eel-light px-2.5 py-1 text-xs font-bold text-midnight">
                        Total ₹21.00
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-charcoal">
                      <span>Payment Method:</span>
                      <span className="font-bold text-midnight">Pay Online via UPI or Cash at Desk</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-green-50/60 p-3.5 border border-ecto-green/30 flex items-center gap-2.5 text-xs text-green-900 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-ecto-green shrink-0" />
                    <span>Calculated with zero hidden fees directly from shop&apos;s rates.</span>
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-graphite/20 bg-midnight p-5 text-paper font-sans">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs">
                      <span className="text-eel-light font-bold">Shop Desktop Queue • Live</span>
                      <span className="font-mono text-[11px] text-white/70">SSE Snapshot delta: 0ms</span>
                    </div>

                    <div className="mt-4 rounded-lg bg-white/10 p-3.5 border border-white/15">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-paper">Order #CP-2084</span>
                        <span className="rounded bg-ecto-green px-2 py-0.5 text-[10px] font-bold text-midnight">
                          READY TO PRINT
                        </span>
                      </div>
                      <p className="text-xs text-white/80 mt-1.5">
                        Project_Draft_Final.pdf • 14 pgs • Duplex B&amp;W • HP LaserJet Pro
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-white/70">
                      <span>Status: Verified format</span>
                      <span className="text-lingot-lime font-bold">1-Click Local Spool</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Context Actions Explanation */}
            <div className="mt-6 border-t border-graphite/10 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-charcoal">
              <div>
                <span className="font-bold text-midnight block">Customer experience:</span>
                <span className="text-ash">{steps[activeStep].customerAction}</span>
              </div>
              <div>
                <span className="font-bold text-midnight block">Shop operator experience:</span>
                <span className="text-ash">{steps[activeStep].shopAction}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
