import React from "react"
import { Header } from "@/components/sections/Header"
import { HeroSection } from "@/components/sections/HeroSection"
import { FactStrip } from "@/components/sections/FactStrip"
import { ProblemSection } from "@/components/sections/ProblemSection"
import { HowItWorksSection } from "@/components/sections/HowItWorksSection"
import { DoorsSection } from "@/components/sections/DoorsSection"
import { TrustSection } from "@/components/sections/TrustSection"
import { FounderSection } from "@/components/sections/FounderSection"
import { ContactSection } from "@/components/sections/ContactSection"
import { Footer } from "@/components/sections/Footer"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col font-sans selection:bg-lime-soft selection:text-ink">
      {/* Ruled Boxed-Grid Container: centered max-w-6xl with visible side rails on desktop, borderless on mobile */}
      <div className="w-full max-w-6xl mx-auto border-x-0 lg:border-x border-neutral-200/80 flex flex-col min-h-screen bg-bg">
        {/* Sticky Header */}
        <Header />

        {/* Main Content Sections strictly in PRD Section 5 order with continuous horizontal dividers */}
        <main id="main-content" className="flex-1 divide-y divide-neutral-200/80">
          {/* Section 5.1: Hero */}
          <HeroSection />

          {/* Section 5.2: Fact Strip */}
          <FactStrip />

          {/* Section 5.3: Problem to Solution */}
          <ProblemSection />

          {/* Section 5.4: How It Works, 3 Steps */}
          <HowItWorksSection />

          {/* Section 5.5: Two Doors */}
          <DoorsSection />

          {/* Section 5.6: Trust Strip */}
          <TrustSection />

          {/* Section 5.7: Founder Note */}
          <FounderSection />

          {/* Section 5.8: Closing CTA & Contact */}
          <ContactSection />
        </main>

        {/* Section 5.9: Footer */}
        <Footer />
      </div>
    </div>
  )
}
