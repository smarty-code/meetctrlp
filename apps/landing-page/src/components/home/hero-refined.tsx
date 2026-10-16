import React from "react"
import Link from "next/link"
import Image from "next/image"
import { siteConfig } from "@/config/site-content"
import {
  ArrowRight,
  FileText,
  Printer,
  Smartphone,
  Laptop,
  CheckCircle2,
} from "lucide-react"

export function HeroRefined() {
  const h = siteConfig.hero

  return (
    <section className="relative overflow-hidden bg-paper py-16 sm:py-24 lg:py-28 border-b border-graphite/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Editorial Centered / Focused Header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-ash">
            {h.eyebrow}
          </p>

          <h1 className="mt-4 font-heading text-4xl font-black tracking-tight text-midnight sm:text-6xl lg:text-7xl leading-[1.08]">
            Printing, without the{" "}
            <span className="text-ecto-green underline decoration-lingot-lime decoration-4 underline-offset-8">
              back-and-forth.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg lg:text-xl font-normal leading-relaxed text-charcoal max-w-2xl mx-auto">
            {h.supportingCopy}
          </p>

          {/* Action CTAs: exactly 2 */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={h.primaryCta.href}
              className="btn-pressable-green inline-flex items-center justify-center gap-2 rounded-xl bg-ecto-green px-7 py-3.5 text-base font-bold text-midnight select-none"
            >
              <span>{h.primaryCta.label}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href={h.secondaryCta.href}
              className="btn-pressable-lime inline-flex items-center justify-center gap-2 rounded-xl bg-paper px-6 py-3.5 text-base font-bold text-midnight select-none hover:bg-eel-light/20"
            >
              <span>{h.secondaryCta.label}</span>
            </Link>
          </div>
        </div>

        {/* One Strong Product Composition with Generous Whitespace */}
        <div className="mt-16 sm:mt-20 rounded-2xl border border-graphite/15 bg-[#fbfdf9] p-6 sm:p-10 lg:p-12 shadow-xs">
          <div className="mx-auto max-w-4xl">
            {/* Supporting Original Artwork */}
            <div className="relative mb-8 overflow-hidden rounded-xl border border-graphite/10 bg-white shadow-2xs">
              <Image
                src={siteConfig.assets.heroWorkflow.src}
                alt={siteConfig.assets.heroWorkflow.alt}
                width={siteConfig.assets.heroWorkflow.width}
                height={siteConfig.assets.heroWorkflow.height}
                priority
                className="w-full h-auto max-h-[360px] object-cover object-center"
              />
              <div className="absolute bottom-3 right-3 rounded-md bg-paper/90 backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold text-midnight shadow-2xs border border-graphite/10">
                Connected Print Flow
              </div>
            </div>

            {/* The Connected Chain: Phone -> Order Specs -> Desktop Spooler -> Printer */}
            <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
              {/* Step 1: Mobile Request (Left, col 4) */}
              <div className="rounded-xl border border-graphite/20 bg-paper p-5 lg:col-span-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-graphite/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-ecto-green" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-midnight">
                      Customer Web
                    </span>
                  </div>
                  <span className="rounded bg-eel-light px-2 py-0.5 text-[10px] font-bold text-midnight">
                    Zero Install
                  </span>
                </div>

                <div className="mt-3.5 space-y-2">
                  <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-2.5 border border-graphite/10">
                    <div className="rounded bg-white p-1.5 border border-graphite/15 text-red-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-midnight truncate">Final_Report_v2.pdf</p>
                      <p className="text-[10px] text-ash">14 pages • A4</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-gray-50/70 p-2 text-[11px] text-charcoal border border-graphite/10 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-ash">Print Mode:</span>
                      <span className="font-bold text-midnight">Duplex (B&amp;W)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ash">Copies:</span>
                      <span className="font-bold text-midnight">1 copy</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t border-graphite/10 pt-2 flex items-center justify-between text-xs">
                  <span className="text-ash">Total: ₹21.00</span>
                  <span className="flex items-center gap-1 font-bold text-green-700 text-[11px]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-ecto-green" /> Sent
                  </span>
                </div>
              </div>

              {/* Connecting Bridge (col 1) */}
              <div className="hidden lg:flex lg:col-span-1 justify-center">
                <ArrowRight className="h-5 w-5 text-ash" />
              </div>

              {/* Step 2: Shop Desktop Queue (Middle, col 4) */}
              <div className="rounded-xl border border-graphite/20 bg-paper p-5 lg:col-span-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-graphite/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-macaw-blue" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-midnight">
                      Shop Desktop Queue
                    </span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-ecto-green animate-pulse" /> Live
                  </span>
                </div>

                <div className="mt-3.5 space-y-2">
                  <div className="rounded-lg border-2 border-ecto-green/60 bg-green-50/30 p-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-midnight">Order #CP-2084</span>
                      <span className="rounded bg-ecto-green px-1.5 py-0.5 text-[9px] font-bold text-midnight">
                        READY
                      </span>
                    </div>
                    <p className="text-[10px] text-charcoal mt-1">
                      14 pages • Duplex • B&amp;W • Paid UPI
                    </p>
                    <button
                      type="button"
                      className="mt-2.5 w-full btn-pressable-green rounded-lg bg-ecto-green py-1.5 text-xs font-bold text-midnight text-center"
                    >
                      Print (Direct Spool)
                    </button>
                  </div>
                </div>

                <div className="mt-3 border-t border-graphite/10 pt-2 text-[10px] text-ash">
                  Auto-routed to least-busy printer
                </div>
              </div>

              {/* Connecting Bridge (col 1) */}
              <div className="hidden lg:flex lg:col-span-1 justify-center">
                <ArrowRight className="h-5 w-5 text-ash" />
              </div>

              {/* Step 3: Connected Printer (Right, col 2) */}
              <div className="rounded-xl border border-graphite/20 bg-paper p-4 lg:col-span-2 text-center shadow-2xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-midnight mx-auto">
                  <Printer className="h-5 w-5 text-midnight" />
                </div>
                <p className="mt-2 text-xs font-bold text-midnight">HP LaserJet Pro</p>
                <p className="text-[10px] text-ash">Windows Spooler</p>
                <span className="mt-2 inline-block rounded bg-eel-light/60 px-2 py-0.5 text-[10px] font-bold text-midnight">
                  Online
                </span>
              </div>
            </div>

            {/* Quiet caption */}
            <p className="mt-6 text-center text-xs text-ash">
              A single connected workflow from customer upload to physical paper print.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
