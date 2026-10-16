import React from "react"
import Link from "next/link"
import Image from "next/image"
import { siteConfig } from "@/config/site-content"
import {
  Printer,
  ArrowRight,
  ListOrdered,
  FileCheck,
  Zap,
} from "lucide-react"

export function DifferentiatorRefined() {
  const d = siteConfig.differentiator
  const pointIcons = [ListOrdered, FileCheck, Zap]

  return (
    <section className="bg-paper py-20 sm:py-28 border-b border-graphite/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-ash">
            {d.eyebrow}
          </p>
          <h2 className="mt-3 font-heading text-3xl font-black tracking-tight text-midnight sm:text-5xl">
            {d.headline}
          </h2>
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-charcoal font-normal">
            {d.copy}
          </p>
        </div>

        {/* 3 Concrete Points + Desktop Application Mockup */}
        <div className="mt-16 grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left: 3 Concrete Points (col 5) */}
          <div className="lg:col-span-5 space-y-6">
            {d.points.map((pt, idx) => {
              const Icon = pointIcons[idx]
              return (
                <div key={pt.title} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-midnight">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-midnight">
                      {pt.title}
                    </h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-charcoal leading-relaxed">
                      {pt.description}
                    </p>
                  </div>
                </div>
              )
            })}

            <div className="pt-4">
              <Link
                href={d.cta.href}
                className="btn-pressable-lime inline-flex items-center gap-2 rounded-xl bg-paper px-6 py-3.5 text-sm font-bold text-midnight select-none hover:bg-eel-light/30"
              >
                <span>{d.cta.label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right: Large Desktop App Mockup with Supporting Workstation Artwork (col 7) */}
          <div className="rounded-2xl border border-graphite/20 bg-gray-900 text-paper p-6 sm:p-8 lg:col-span-7 shadow-xs space-y-5">
            {/* Supporting Workstation Image */}
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <Image
                src={siteConfig.assets.printerWorkspaceWide.src}
                alt={siteConfig.assets.printerWorkspaceWide.alt}
                width={siteConfig.assets.printerWorkspaceWide.width}
                height={siteConfig.assets.printerWorkspaceWide.height}
                loading="lazy"
                className="w-full h-auto object-cover max-h-[220px]"
              />
            </div>
            {/* Desktop Window Title Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="h-3 w-3 rounded-full bg-green-500/80 inline-block" />
                <span className="ml-2 font-mono text-xs text-white/70">
                  CtrlP Print Shop Desktop — Windows Tauri + .NET 8
                </span>
              </div>
              <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-eel-light">
                Spooler Online
              </span>
            </div>

            {/* Desktop Queue & Printer Status */}
            <div className="mt-6 space-y-4 font-sans">
              <div className="flex items-center justify-between rounded-xl bg-white/5 p-4 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
                    <Printer className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-paper">HP LaserJet Pro 4004 (Default)</p>
                    <p className="text-[11px] text-white/60">GDI Spooler • 0 active print jobs</p>
                  </div>
                </div>
                <span className="rounded-md bg-ecto-green/20 text-lingot-lime px-2.5 py-1 text-xs font-bold border border-ecto-green/30">
                  Ready
                </span>
              </div>

              {/* Order Card in Desktop Queue */}
              <div className="rounded-xl border border-white/15 bg-white/10 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-paper font-heading">
                    Incoming Order #CP-2084 • Counter Queue
                  </span>
                  <span className="text-[11px] text-white/60">Just now</span>
                </div>

                <div className="rounded-lg bg-black/30 p-3 text-xs space-y-1.5 font-mono">
                  <p className="text-white/80">File: Thesis_Submission_Draft.pdf</p>
                  <p className="text-lingot-lime">Pages: 1-14 (All) • Duplex: TRUE • Mode: MONOCHROME</p>
                  <p className="text-white/60">Payment: PAID_ONLINE (UPI) • Subtotal: ₹21.00</p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    className="btn-pressable-green rounded-lg bg-ecto-green px-5 py-2 text-xs font-bold text-midnight"
                  >
                    Print to HP LaserJet Pro
                  </button>
                  <span className="text-[11px] text-white/50">
                    No manual PDF download or printer setting adjustments required
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-3 text-[11px] text-white/50">
              Verified local Windows print spooling via named-pipe RPC architecture.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
