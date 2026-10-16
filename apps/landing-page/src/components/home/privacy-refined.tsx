import React from "react"
import Link from "next/link"
import Image from "next/image"
import { siteConfig } from "@/config/site-content"
import { Lock, Clock, FileCheck, ArrowRight, Info } from "lucide-react"

export function PrivacyRefined() {
  const p = siteConfig.privacy
  const icons = [Lock, Clock, FileCheck]

  return (
    <section className="bg-paper py-20 sm:py-28 border-b border-graphite/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wider text-ash">
            {p.eyebrow}
          </p>
          <h2 className="mt-3 font-heading text-3xl font-black tracking-tight text-midnight sm:text-5xl">
            {p.headline}
          </h2>
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-charcoal font-normal">
            {p.copy}
          </p>
        </div>

        {/* Supporting Editorial Artwork */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-graphite/10 bg-[#fafbfa]">
          <Image
            src={siteConfig.assets.documentPrivacy.src}
            alt={siteConfig.assets.documentPrivacy.alt}
            width={siteConfig.assets.documentPrivacy.width}
            height={siteConfig.assets.documentPrivacy.height}
            loading="lazy"
            className="w-full h-auto object-cover max-h-[300px]"
          />
        </div>

        {/* 3 Quiet Principles (not 4 dense cards) */}
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {p.principles.map((principle, idx) => {
            const Icon = icons[idx]
            return (
              <div
                key={principle.title}
                className="rounded-xl border border-graphite/15 bg-paper p-6 sm:p-7 transition-all hover:border-graphite/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-midnight">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-bold text-midnight">
                  {principle.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-charcoal">
                  {principle.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* Quiet Disclosure & Privacy Policy Link */}
        <div className="mt-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-graphite/15 bg-gray-50/70 p-5">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-ash shrink-0 mt-0.5" />
            <p className="text-xs text-charcoal max-w-2xl leading-relaxed">
              <span className="font-bold text-midnight">Engineering verification standard: </span>
              {p.disclosure}
            </p>
          </div>

          <Link
            href={p.linkHref}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-midnight hover:text-ecto-green underline underline-offset-4 shrink-0"
          >
            <span>{p.linkText}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
