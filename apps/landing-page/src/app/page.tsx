import React from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { HeroRefined } from "@/components/home/hero-refined"
import { ProblemPromiseSection } from "@/components/home/problem-promise-section"
import { WorkflowInteractiveSection } from "@/components/home/workflow-interactive-section"
import { DifferentiatorRefined } from "@/components/home/differentiator-refined"
import { PrivacyRefined } from "@/components/home/privacy-refined"
import { PartnerSectionRefined } from "@/components/home/partner-section-refined"
import { ChangelogPreviewSection } from "@/components/home/changelog-preview-section"
import { FaqContactSection } from "@/components/home/faq-contact-section"
import { FinalCtaRefined } from "@/components/home/final-cta-refined"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper text-charcoal font-sans selection:bg-eel-light selection:text-midnight">
      {/* Navigation */}
      <Header />

      <main id="main-content">
        {/* Section B: Hero — One Promise, One Visual */}
        <HeroRefined />

        {/* Section C: Problem & Promise — From Scattered Messages to a Clear Job */}
        <ProblemPromiseSection />

        {/* Section D: Product Workflow — Every Print Job Arrives with Details */}
        <WorkflowInteractiveSection />

        {/* Section E: Core Differentiator — Desktop App & Local Printer Integration */}
        <DifferentiatorRefined />

        {/* Section F: Trust & Document Privacy — Quiet & Honest Handling */}
        <PrivacyRefined />

        {/* Section G: For Print-Shop Partners — Benefits & Guided Onboarding */}
        <PartnerSectionRefined />

        {/* Section H: Changelog Preview — Built in the Open */}
        <ChangelogPreviewSection />

        {/* Section J: FAQ & Shop Contact Accordion */}
        <FaqContactSection />

        {/* Section I: Final Decisive CTA — Dark Navy Close */}
        <FinalCtaRefined />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
