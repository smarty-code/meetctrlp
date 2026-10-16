import React from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site-content"
import { ArrowRight } from "lucide-react"

export function FinalCtaRefined() {
  const cta = siteConfig.finalCta

  return (
    <section className="bg-midnight py-20 sm:py-28 text-paper">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <h2 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-paper">
          {cta.headline}
        </h2>

        <p className="mt-5 text-base sm:text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
          {cta.supportingCopy}
        </p>

        {/* Exactly 2 Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={cta.primaryCta.href}
            className="btn-pressable-green inline-flex items-center gap-2 rounded-xl bg-ecto-green px-7 py-3.5 text-base font-bold text-midnight select-none"
          >
            <span>{cta.primaryCta.label}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href={cta.secondaryCta.href}
            className="btn-pressable-lime inline-flex items-center gap-2 rounded-xl bg-transparent border-2 border-lingot-lime px-7 py-3.5 text-base font-bold text-lingot-lime select-none hover:bg-white/5"
          >
            <span>{cta.secondaryCta.label}</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
