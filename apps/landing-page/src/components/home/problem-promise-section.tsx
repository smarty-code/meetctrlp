import React from "react"
import Image from "next/image"
import { siteConfig } from "@/config/site-content"
import { Check, X, QrCode, Sliders, Laptop } from "lucide-react"

export function ProblemPromiseSection() {
  const p = siteConfig.problemAndPromise
  const stripIcons = [QrCode, Sliders, Laptop]

  return (
    <section id="problem" className="bg-paper py-20 sm:py-28 border-b border-graphite/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Heading */}
        <div className="max-w-3xl">
          <h2 className="font-heading text-3xl font-black tracking-tight text-midnight sm:text-5xl">
            {p.headline}
          </h2>
          <p className="mt-5 text-base sm:text-lg leading-relaxed text-charcoal font-normal">
            {p.copy}
          </p>
        </div>

        {/* Compact Today vs With MeetCtrlP comparison (2-3 points only) */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Today's friction */}
          <div className="rounded-xl border border-red-200/80 bg-red-50/20 p-6 sm:p-7">
            <span className="rounded-md bg-red-100 px-2.5 py-1 text-xs font-bold text-red-900 uppercase tracking-wide">
              {p.comparison.today.title}
            </span>
            <ul className="mt-5 space-y-3.5">
              {p.comparison.today.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2.5 text-xs sm:text-sm text-charcoal leading-relaxed">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-xs mt-0.5">
                    <X className="h-3 w-3" />
                  </span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* With MeetCtrlP */}
          <div className="rounded-xl border border-ecto-green/50 bg-[#fbfdf9] p-6 sm:p-7 shadow-2xs">
            <span className="rounded-md bg-eel-light px-2.5 py-1 text-xs font-bold text-midnight uppercase tracking-wide">
              {p.comparison.withCtrlP.title}
            </span>
            <ul className="mt-5 space-y-3.5">
              {p.comparison.withCtrlP.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2.5 text-xs sm:text-sm text-charcoal leading-relaxed">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-eel-light text-midnight font-bold text-xs mt-0.5">
                    <Check className="h-3 w-3 text-ecto-green" strokeWidth={3} />
                  </span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* One Workflow Strip: 3 Steps + Supporting Artwork */}
        <div className="mt-14 rounded-2xl border border-graphite/15 bg-[#fbfdf9] p-6 sm:p-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4 relative overflow-hidden rounded-xl border border-graphite/10 bg-white">
              <Image
                src={siteConfig.assets.userQrUpload.src}
                alt={siteConfig.assets.userQrUpload.alt}
                width={siteConfig.assets.userQrUpload.width}
                height={siteConfig.assets.userQrUpload.height}
                loading="lazy"
                className="w-full h-auto object-cover max-h-[260px]"
              />
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 gap-5">
              {p.workflowStrip.map((item, idx) => {
                const Icon = stripIcons[idx]
                return (
                  <div key={item.step} className="flex items-start gap-4 bg-paper rounded-xl p-4 border border-graphite/10">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 border border-graphite/15 text-midnight shadow-2xs">
                      <Icon className="h-5 w-5 text-ecto-green" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-ash">
                          {item.step}
                        </span>
                        <h3 className="font-heading text-base font-bold text-midnight">
                          {item.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm text-charcoal leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
