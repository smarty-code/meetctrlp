"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { MobileHeader } from "./mobile-header"
import { HeroSection } from "./hero-section"
import { HomeEntryCard } from "./home-entry-card"
import { ScanShopQrOverlay } from "./scan-shop-qr-overlay"
import { PromiseSection } from "./promise-section"
import { FAQSection } from "./faq-section"
import { BrandFooter } from "./brand-footer"
import { faqList } from "../data/mock-shop"

const homeFaqs = [
  {
    id: "faq-scan",
    question: "How do I start printing?",
    answer:
      "Tap Scan QR code and point your camera at the QR on the shop counter. That opens this shop's print page so you can upload documents.",
  },
  ...faqList,
]

export const HomeLanding: React.FC = () => {
  const router = useRouter()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper selection:bg-macaw-blue selection:text-paper">
      <main className="relative flex min-h-screen w-full flex-col bg-paper">
        {notification ? (
          <div className="animate-fadeIn fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-graphite/30 bg-midnight px-4 py-2 text-caption font-bold text-paper">
            {notification}
          </div>
        ) : null}
        <MobileHeader onSearch={() => showToast("Search services coming soon")} />
        <HeroSection isAvailable stickerText="Print it. Pick it. Done." />
        <HomeEntryCard onScanQr={() => setScannerOpen(true)} />
        <PromiseSection />
        <FAQSection items={homeFaqs} />
        <BrandFooter />
        <ScanShopQrOverlay
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onShopFound={(slug) => {
            setScannerOpen(false)
            router.push(`/s/${slug}`)
          }}
        />
      </main>
    </div>
  )
}
