import type { CSSProperties } from "react"
import type { Metadata } from "next"
import { visionPage } from "@/content/pages"
import { siteConfig } from "@/content/site-config"
import { PageShell } from "@/components/editorial/PageShell"
import { Breadcrumb } from "@/components/editorial/Breadcrumb"
import { EdgeAccent, HalftoneBackdrop } from "@/components/editorial/Backdrop"
import { SplitTextReveal } from "@/components/editorial/SplitTextReveal"
import { TicketCard } from "@/components/editorial/TicketCard"

export const metadata: Metadata = {
  title: visionPage.meta.title,
  description: visionPage.meta.description,
  alternates: { canonical: "/vision" },
}

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties

/** /vision: an editorial manifesto letter on a perforated card (Vestris vision layout). */
export default function VisionPage() {
  const { heading, subtitle, paragraphs, closing, signoffRole } = visionPage
  const [first = "", ...rest] = paragraphs
  const dropCap = first.charAt(0)
  const step = 40
  const secondStart = (heading.open.length + heading.first.length + 1) * step

  return (
    <PageShell>
      <section aria-labelledby="vision-title">
        <div className="relative z-10 px-4 sm:px-6 pt-16 pb-6 text-center">
          <Breadcrumb current={visionPage.breadcrumb} />

          <h1
            id="vision-title"
            className="mt-6 flex items-center justify-center gap-4 sm:gap-8 md:gap-12 font-display text-[clamp(2.25rem,8vw,4.5rem)] leading-none tracking-[-0.02em] text-ink whitespace-nowrap"
          >
            <SplitTextReveal text={heading.open} className="font-light italic opacity-80 text-ink-faint" stepMs={step} />
            <span className="inline-flex gap-[0.25em]">
              <SplitTextReveal text={heading.first} baseDelayMs={step} stepMs={step} />
              <SplitTextReveal
                text={heading.second}
                baseDelayMs={secondStart}
                stepMs={step}
                className="italic text-lime-deep"
              />
            </span>
            <SplitTextReveal
              text={heading.close}
              baseDelayMs={secondStart + heading.second.length * step}
              stepMs={step}
              className="font-light italic opacity-80 text-ink-faint"
            />
          </h1>

          <p
            className="rise-in mt-4 md:mt-6 font-display italic text-xl sm:text-2xl md:text-3xl text-ink-soft"
            style={delay(500)}
          >
            {subtitle}
          </p>
        </div>

        {/* Backdrop and edge framing around the reading card */}
        <div className="relative w-full pt-8 pb-24 overflow-hidden">
          <HalftoneBackdrop />
          <EdgeAccent side="left" />
          <EdgeAccent side="right" />

          <div className="relative z-10 px-4 sm:px-6">
            <TicketCard widthClass="max-w-[600px]" paddingClass="p-6 sm:p-10 md:p-14" delayMs={600}>
              <div className="space-y-5 text-[15px] sm:text-base leading-[1.75] text-ink-soft">
                <p className="text-ink">
                  <span
                    aria-hidden="true"
                    className="float-left mr-3 mt-1 font-display text-5xl sm:text-6xl leading-[0.8] text-lime-deep"
                  >
                    {dropCap}
                  </span>
                  <span className="sr-only">{dropCap}</span>
                  {first.slice(1)}
                </p>
                {rest.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p className="text-ink">{closing}</p>
              </div>

              <div className="mt-10 pt-6 border-t border-line text-sm text-ink-soft">
                <span className="font-semibold text-ink">{siteConfig.contact.founderName}</span>,{" "}
                <span className="italic">{signoffRole}</span>
              </div>
            </TicketCard>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
