import React from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site-content"
import { ArrowRight } from "lucide-react"

export function ChangelogPreviewSection() {
  const c = siteConfig.changelogPreview

  return (
    <section className="bg-paper py-16 sm:py-24 border-b border-graphite/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-graphite/10 pb-6">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-black text-midnight">
              {c.headline}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-charcoal">
              {c.lead}
            </p>
          </div>

          <Link
            href={c.viewAllCta.href}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-midnight hover:text-ecto-green underline underline-offset-4 shrink-0"
          >
            <span>{c.viewAllCta.label}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* 2 Recent Updates */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {c.items.map((item) => (
            <div
              key={item.version}
              className="rounded-xl border border-graphite/15 bg-paper p-5 sm:p-6 transition-all hover:border-graphite/30"
            >
              <div className="flex items-center justify-between text-xs text-ash">
                <span className="rounded bg-gray-100 font-mono font-bold text-midnight px-2 py-0.5">
                  {item.version}
                </span>
                <span>{item.date}</span>
              </div>

              <h3 className="mt-3 font-heading text-base font-bold text-midnight">
                {item.title}
              </h3>

              <p className="mt-2 text-xs sm:text-sm text-charcoal leading-relaxed">
                {item.summary}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
