"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Printer,
  QrCode,
  FileText,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Sparkles,
  UploadCloud,
  Store,
  Sliders,
  Smartphone,
  HardDriveDownload,
  AlertCircle,
  HelpCircle,
} from "lucide-react"

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(0)
  const [activeTab, setActiveTab] = useState<"student" | "shop">("student")

  // Interactive Live Calculator state
  const [pages, setPages] = useState<number>(12)
  const [copies, setCopies] = useState<number>(1)
  const [isColor, setIsColor] = useState<boolean>(false)
  const [isDoubleSided, setIsDoubleSided] = useState<boolean>(true)

  // Pricing formula: ₹2 per page B&W single, ₹1.5 double; ₹10 color single, ₹8 double
  const perPageRate = isColor ? (isDoubleSided ? 8 : 10) : isDoubleSided ? 1.5 : 2
  const totalCost = Math.round(pages * copies * perPageRate)

  const faqs = [
    {
      q: "Do I need to install an app on my phone to print?",
      a: "No! CtrlP runs completely in your mobile browser. Simply scan the QR code placed on the print shop's desk, upload your PDF or photos, and your job is instantly sent to the shop's printer queue.",
    },
    {
      q: "What happens to my uploaded documents after printing?",
      a: "Your privacy is paramount. Uploaded files are encrypted in transit and at rest, and are automatically purged from both the cloud and the shop's local cache right after the print job finishes.",
    },
    {
      q: "Why is CtrlP better than sending files via WhatsApp or email?",
      a: "Sending via WhatsApp compresses PDFs, exposes your phone number to strangers, and forces shop owners to manually download, rename, open, and configure printer settings. CtrlP auto-spools the job directly into the printer with exact page ranges, duplex, and color options.",
    },
    {
      q: "How do print shop owners install CtrlP?",
      a: "Shop owners download our lightweight CtrlP Desktop Agent on their Windows or Mac PC. It automatically detects connected printers, accepts incoming customer queues, and prints documents in one click.",
    },
    {
      q: "Are there any hidden service charges for students?",
      a: "Zero hidden charges. You pay standard shop rates directly through UPI or at the counter. CtrlP is 100% transparent.",
    },
  ]

  return (
    <div className="min-h-screen bg-paper text-charcoal font-sans">
      {/* Top Banner Notice */}
      <div className="bg-midnight px-4 py-2 text-center text-xs font-bold text-eel-light">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-lingot-lime" />
          <span>CtrlP is live across select campus & neighborhood print shops!</span>
          <span className="hidden sm:inline text-paper/70 font-normal">
            — Experience queue-free printing.
          </span>
        </span>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b-2 border-graphite/10 bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 select-none group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ecto-green text-paper shadow-2xs transition-transform group-hover:scale-105">
                <Printer className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <span className="font-heading text-2xl font-black tracking-tight text-midnight">
                  Ctrl<span className="text-ecto-green">P</span>
                </span>
                <span className="hidden text-[10px] font-extrabold tracking-widest text-ash uppercase sm:block">
                  Print On Demand
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#how-it-works"
              className="text-sm font-bold text-charcoal transition-colors hover:text-ecto-green"
            >
              How It Works
            </a>
            <a
              href="#calculator"
              className="text-sm font-bold text-charcoal transition-colors hover:text-ecto-green"
            >
              Live Calculator
            </a>
            <a
              href="#features"
              className="text-sm font-bold text-charcoal transition-colors hover:text-ecto-green"
            >
              Why CtrlP
            </a>
            <a
              href="#shop-owners"
              className="text-sm font-bold text-charcoal transition-colors hover:text-ecto-green"
            >
              For Print Shops
            </a>
            <a
              href="#faq"
              className="text-sm font-bold text-charcoal transition-colors hover:text-ecto-green"
            >
              FAQ
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden items-center gap-3 sm:flex">
            <a
              href="#calculator"
              className="btn-pressable-lime rounded-xl bg-paper px-4 py-2 text-sm font-bold text-midnight select-none hover:bg-eel-light/30"
            >
              Calculate Price
            </a>
            <a
              href="#demo-qr"
              className="btn-pressable-green rounded-xl bg-ecto-green px-4 py-2 text-sm font-bold text-paper select-none"
            >
              Scan Demo QR
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl border-2 border-graphite/20 p-2 text-midnight md:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="border-t-2 border-graphite/10 bg-paper px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3 font-bold text-charcoal">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-ecto-green"
              >
                How It Works
              </a>
              <a
                href="#calculator"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-ecto-green"
              >
                Live Calculator
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-ecto-green"
              >
                Why CtrlP
              </a>
              <a
                href="#shop-owners"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-ecto-green"
              >
                For Print Shops
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-ecto-green"
              >
                FAQ
              </a>
              <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-graphite/10">
                <a
                  href="#calculator"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl border-2 border-lingot-lime py-2.5 text-center text-sm font-bold text-midnight"
                >
                  Calculate Price
                </a>
                <a
                  href="#demo-qr"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-pressable-green rounded-xl bg-ecto-green py-2.5 text-center text-sm font-bold text-paper"
                >
                  Scan Demo QR
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b-2 border-graphite/10 bg-[#f9fdf5] px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            {/* Left Column: Headlines & Call to Action */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-xl border-2 border-lingot-lime bg-paper px-3.5 py-1.5 text-xs font-bold text-midnight uppercase tracking-wider select-none">
                <span className="flex h-2 w-2 rounded-full bg-ecto-green animate-pulse" />
                Zero Queue Printing
              </div>

              <h1 className="mt-5 font-heading text-4xl font-black leading-tight tracking-tight text-midnight sm:text-5xl lg:text-6xl">
                Skip the print queue. <br />
                <span className="text-ecto-green">Print from your phone</span> in seconds.
              </h1>

              <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-charcoal sm:text-lg">
                No messy WhatsApp chats, no USB pendrive viruses, and no waiting 20 minutes for
                your turn. Scan the shop counter QR, pick your options, and pick up hot prints.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#demo-qr"
                  className="btn-pressable-green inline-flex items-center justify-center gap-2 rounded-xl bg-ecto-green px-6 py-3.5 text-base font-bold text-paper select-none"
                >
                  <QrCode className="h-5 w-5" />
                  Try Live Web App
                </a>
                <a
                  href="#how-it-works"
                  className="btn-pressable-lime inline-flex items-center justify-center gap-2 rounded-xl bg-paper px-6 py-3.5 text-base font-bold text-midnight select-none hover:bg-eel-light/30"
                >
                  See How It Works
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* Social Proof Counters */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t-2 border-graphite/10 pt-6">
                <div>
                  <div className="font-heading text-2xl font-black text-midnight sm:text-3xl">
                    50k+
                  </div>
                  <div className="text-xs font-bold text-ash uppercase tracking-wider">
                    Pages Printed
                  </div>
                </div>
                <div>
                  <div className="font-heading text-2xl font-black text-ecto-green sm:text-3xl">
                    &lt; 30s
                  </div>
                  <div className="text-xs font-bold text-ash uppercase tracking-wider">
                    Counter Pickup
                  </div>
                </div>
                <div>
                  <div className="font-heading text-2xl font-black text-macaw-blue sm:text-3xl">
                    100%
                  </div>
                  <div className="text-xs font-bold text-ash uppercase tracking-wider">
                    Private & Auto-Purged
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Card Mockup */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border-2 border-graphite/15 bg-paper p-5 sm:p-6 select-none">
                {/* Mock Phone / Order Header */}
                <div className="flex items-center justify-between border-b-2 border-graphite/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-eel-light text-midnight font-bold">
                      <Store className="h-5 w-5 text-[#3b8c00]" />
                    </div>
                    <div>
                      <div className="font-bold text-midnight text-sm">Campus Print Hub #4</div>
                      <div className="flex items-center gap-1.5 text-xs text-ash font-medium">
                        <span className="inline-block h-2 w-2 rounded-full bg-ecto-green" />
                        Counter 2 — Ready to Print
                      </div>
                    </div>
                  </div>
                  <span className="rounded-xl border border-lingot-lime bg-eel-light/40 px-2.5 py-1 text-[11px] font-bold text-midnight uppercase tracking-wider">
                    Live
                  </span>
                </div>

                {/* Upload Preview Card */}
                <div className="mt-4 rounded-xl border-2 border-dashed border-lingot-lime bg-[#fafff5] p-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-ecto-green text-paper">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="mt-2 text-sm font-bold text-midnight">
                    final_project_report_v2.pdf
                  </div>
                  <div className="text-xs text-ash font-medium">18 pages • 2.4 MB • Ready</div>
                </div>

                {/* Settings selector pills */}
                <div className="mt-4 space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl border-2 border-graphite/10 bg-paper px-3 py-2 text-xs">
                    <span className="font-bold text-ash uppercase tracking-wider">Color Mode</span>
                    <span className="font-bold text-midnight bg-eel-light/50 px-2.5 py-1 rounded-lg">
                      Black & White (₹2/page)
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border-2 border-graphite/10 bg-paper px-3 py-2 text-xs">
                    <span className="font-bold text-ash uppercase tracking-wider">Sides</span>
                    <span className="font-bold text-midnight bg-eel-light/50 px-2.5 py-1 rounded-lg">
                      Double-Sided (Duplex)
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border-2 border-graphite/10 bg-paper px-3 py-2 text-xs">
                    <span className="font-bold text-ash uppercase tracking-wider">Copies</span>
                    <span className="font-bold text-midnight bg-eel-light/50 px-2.5 py-1 rounded-lg">
                      1 Copy
                    </span>
                  </div>
                </div>

                {/* Total & Action */}
                <div className="mt-5 border-t-2 border-graphite/10 pt-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-xs font-bold text-ash uppercase tracking-wider">
                      Estimated Cost
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="font-heading text-2xl font-black text-midnight">₹27.00</span>
                      <span className="text-xs text-ash font-medium">tax incl.</span>
                    </div>
                  </div>

                  <button className="btn-pressable-green w-full rounded-xl bg-ecto-green py-3 text-center text-sm font-bold text-paper flex items-center justify-center gap-2 cursor-pointer">
                    <Zap className="h-4 w-4" />
                    Send to Print Queue
                  </button>
                  <p className="mt-2 text-center text-[11px] font-medium text-ash">
                    No payment gateway fee • Pick up and pay or UPI
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-b-2 border-graphite/10 bg-paper px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <span className="rounded-xl border-2 border-lingot-lime bg-eel-light/30 px-3 py-1 text-xs font-bold text-midnight uppercase tracking-wider">
              Simple 3-Step Flow
            </span>
            <h2 className="mt-3 font-heading text-3xl font-black text-midnight sm:text-4xl">
              How CtrlP Works in 30 Seconds
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-medium text-charcoal sm:text-base">
              Say goodbye to forwarding PDFs to an unknown shopkeeper’s WhatsApp and waiting in crowded rooms.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {/* Step 1 */}
            <div className="rounded-xl border-2 border-graphite/15 bg-paper p-6 relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-eel-light text-midnight font-heading text-xl font-black mb-4">
                1
              </div>
              <h3 className="font-heading text-xl font-bold text-midnight">Scan Shop QR</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal font-medium">
                Locate the CtrlP QR standee at the shop counter. Scan it with any smartphone camera or UPI scanner — no app download required.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-ecto-green">
                <QrCode className="h-4 w-4" /> Instant browser launch
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border-2 border-graphite/15 bg-paper p-6 relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-eel-light text-midnight font-heading text-xl font-black mb-4">
                2
              </div>
              <h3 className="font-heading text-xl font-bold text-midnight">Upload & Configure</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal font-medium">
                Upload your PDF, DOCX, or images. Choose color vs B&W, duplex, page ranges, and number of copies. See live price calculation.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-ecto-green">
                <Sliders className="h-4 w-4" /> Transparent page pricing
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border-2 border-graphite/15 bg-paper p-6 relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-eel-light text-midnight font-heading text-xl font-black mb-4">
                3
              </div>
              <h3 className="font-heading text-xl font-bold text-midnight">Grab & Go</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal font-medium">
                The desktop agent at the shop auto-spools your job directly to their high-speed printer. Walk in, collect your warm sheets, and leave.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-ecto-green">
                <Clock className="h-4 w-4" /> Zero queue waiting
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live Price Estimator */}
      <section id="calculator" className="border-b-2 border-graphite/10 bg-[#fafdf7] px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <span className="rounded-xl border-2 border-macaw-blue bg-paper px-3 py-1 text-xs font-bold text-macaw-blue uppercase tracking-wider">
              Transparent Calculator
            </span>
            <h2 className="mt-3 font-heading text-3xl font-black text-midnight sm:text-4xl">
              Calculate Your Print Cost Instantly
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-charcoal sm:text-base">
              Try adjusting the settings below to see how our campus print shop partners price your jobs.
            </p>
          </div>

          <div className="mt-10 rounded-xl border-2 border-graphite/15 bg-paper p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Slider for Pages */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="pages-slider" className="text-sm font-bold text-midnight">
                    Document Pages: <span className="text-ecto-green text-base">{pages}</span>
                  </label>
                  <span className="text-xs font-bold text-ash">1 to 100 pages</span>
                </div>
                <input
                  id="pages-slider"
                  type="range"
                  min="1"
                  max="100"
                  value={pages}
                  onChange={(e) => setPages(Number(e.target.value))}
                  className="w-full accent-[#58cc02] cursor-pointer"
                />
              </div>

              {/* Slider for Copies */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="copies-slider" className="text-sm font-bold text-midnight">
                    Number of Copies: <span className="text-ecto-green text-base">{copies}</span>
                  </label>
                  <span className="text-xs font-bold text-ash">1 to 10 sets</span>
                </div>
                <input
                  id="copies-slider"
                  type="range"
                  min="1"
                  max="10"
                  value={copies}
                  onChange={(e) => setCopies(Number(e.target.value))}
                  className="w-full accent-[#58cc02] cursor-pointer"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="mt-6 grid grid-cols-2 gap-4 border-t-2 border-graphite/10 pt-6">
              {/* Color Mode Toggle */}
              <div
                onClick={() => setIsColor(!isColor)}
                className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-colors select-none ${
                  isColor
                    ? "border-ecto-green bg-eel-light/30"
                    : "border-graphite/15 bg-paper hover:bg-graphite/5"
                }`}
              >
                <div className="text-xs font-bold text-ash uppercase tracking-wider">Color Scheme</div>
                <div className="mt-1 font-bold text-midnight text-sm sm:text-base">
                  {isColor ? "🎨 Full Color" : "📄 Black & White"}
                </div>
                <div className="text-[11px] text-charcoal font-medium mt-0.5">
                  {isColor ? "₹8 - ₹10/pg" : "₹1.5 - ₹2/pg"}
                </div>
              </div>

              {/* Duplex Toggle */}
              <div
                onClick={() => setIsDoubleSided(!isDoubleSided)}
                className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-colors select-none ${
                  isDoubleSided
                    ? "border-ecto-green bg-eel-light/30"
                    : "border-graphite/15 bg-paper hover:bg-graphite/5"
                }`}
              >
                <div className="text-xs font-bold text-ash uppercase tracking-wider">Printing Sides</div>
                <div className="mt-1 font-bold text-midnight text-sm sm:text-base">
                  {isDoubleSided ? "🔄 Double Sided" : "📑 Single Sided"}
                </div>
                <div className="text-[11px] text-charcoal font-medium mt-0.5">
                  {isDoubleSided ? "Eco savings applied" : "Standard single"}
                </div>
              </div>
            </div>

            {/* Total Cost Display Box */}
            <div className="mt-6 rounded-xl border-2 border-lingot-lime bg-[#f4faee] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-ash uppercase tracking-wider">
                  Total Print Cost
                </div>
                <div className="font-heading text-3xl sm:text-4xl font-black text-midnight">
                  ₹{totalCost}.00
                </div>
                <div className="text-xs text-charcoal font-medium">
                  {pages} pages × {copies} {copies > 1 ? "copies" : "copy"} @ ₹{perPageRate}/page
                </div>
              </div>

              <a
                href="#demo-qr"
                className="btn-pressable-green w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-ecto-green px-6 py-3 text-sm font-bold text-paper select-none"
              >
                <UploadCloud className="h-4 w-4" />
                Upload & Print This Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Section */}
      <section id="features" className="border-b-2 border-graphite/10 bg-paper px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <span className="rounded-xl border-2 border-graphite/20 bg-paper px-3 py-1 text-xs font-bold text-charcoal uppercase tracking-wider">
              The CtrlP Advantage
            </span>
            <h2 className="mt-3 font-heading text-3xl font-black text-midnight sm:text-4xl">
              Why Traditional Printing is Broken
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-charcoal sm:text-base">
              Comparing standard print shop friction with the seamless CtrlP cloud agent experience.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Traditional way */}
            <div className="rounded-xl border-2 border-graphite/15 bg-paper p-6">
              <div className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 uppercase tracking-wider">
                <AlertCircle className="h-3.5 w-3.5" />
                The Old Way
              </div>
              <h3 className="mt-3 font-heading text-xl font-bold text-midnight">
                Pendrives & WhatsApp Chaos
              </h3>
              <ul className="mt-4 space-y-3 text-sm font-medium text-charcoal">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-red-500 font-bold">✕</span>
                  <span>Plugging personal USBs into malware-infected shop computers.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-red-500 font-bold">✕</span>
                  <span>Sharing personal phone numbers on WhatsApp to forward assignments.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-red-500 font-bold">✕</span>
                  <span>Explaining page numbers 4 times verbally over counter noise.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-red-500 font-bold">✕</span>
                  <span>Standing in line for 25 minutes while others figure out their documents.</span>
                </li>
              </ul>
            </div>

            {/* CtrlP Way */}
            <div className="rounded-xl border-2 border-ecto-green bg-[#f7fcf2] p-6">
              <div className="inline-flex items-center gap-2 rounded-xl border border-lingot-lime bg-eel-light px-3 py-1 text-xs font-bold text-midnight uppercase tracking-wider">
                <CheckCircle2 className="h-3.5 w-3.5 text-ecto-green" />
                The CtrlP Way
              </div>
              <h3 className="mt-3 font-heading text-xl font-bold text-midnight">
                Direct Cloud Spooling
              </h3>
              <ul className="mt-4 space-y-3 text-sm font-medium text-midnight">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-ecto-green font-bold">✓</span>
                  <span>100% wireless and browser-based. No pendrives or cables ever needed.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-ecto-green font-bold">✓</span>
                  <span>Strict zero-knowledge privacy: files auto-delete immediately after printing.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-ecto-green font-bold">✓</span>
                  <span>Exact page selections, color modes, and duplex options set from your screen.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-ecto-green font-bold">✓</span>
                  <span>Collect and leave within 30 seconds of walking through the shop door.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* For Print Shops Section */}
      <section id="shop-owners" className="border-b-2 border-graphite/10 bg-[#f4f7fa] px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <span className="rounded-xl border-2 border-macaw-blue bg-paper px-3 py-1 text-xs font-bold text-macaw-blue uppercase tracking-wider">
                For Print Shop Owners
              </span>
              <h2 className="mt-3 font-heading text-3xl font-black text-midnight sm:text-4xl">
                Supercharge Your Print Shop With Our Desktop Agent
              </h2>
              <p className="mt-4 text-base font-medium leading-relaxed text-charcoal">
                Tired of managing hundreds of customer WhatsApp messages, downloading random PDFs, and manually opening print dialogues? CtrlP Desktop connects directly to your printers and queues everything automatically.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper border border-graphite/15 text-ecto-green">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold text-midnight">
                    Zero-click auto-spooling straight to Canon, HP, Xerox, Epson printers.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper border border-graphite/15 text-ecto-green">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold text-midnight">
                    Live queue dashboard on your desktop: see incoming orders and totals.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper border border-graphite/15 text-ecto-green">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-bold text-midnight">
                    No hardware changes required. Works on any Windows 10/11 or macOS PC.
                  </span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <button className="btn-pressable-blue rounded-xl bg-macaw-blue px-6 py-3 text-sm font-bold text-paper cursor-pointer select-none">
                  Download Shop Agent (.exe)
                </button>
                <button className="rounded-xl border-2 border-graphite/20 bg-paper px-6 py-3 text-sm font-bold text-midnight hover:bg-graphite/5 cursor-pointer select-none">
                  Request Partner QR Kit
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-xl border-2 border-graphite/15 bg-midnight p-6 text-paper">
                <div className="flex items-center justify-between border-b border-paper/10 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="ml-2 font-mono text-xs text-paper/60">CtrlP Shop Agent v2.4</span>
                  </div>
                  <span className="rounded-md bg-ecto-green/20 px-2 py-0.5 font-mono text-[11px] font-bold text-lingot-lime">
                    CONNECTED
                  </span>
                </div>

                <div className="mt-4 font-mono text-xs text-paper/80 space-y-2">
                  <p className="text-lingot-lime">&gt; Agent started on printer: HP LaserJet Pro MFP</p>
                  <p>&gt; Listening to incoming queue channel: shop-cp-04</p>
                  <p className="text-macaw-blue">&gt; [14:02] Order #8921 received: 18 pgs (Duplex, B&W)</p>
                  <p className="text-paper/60">&gt; Spooling PDF pages 1-18 directly to tray 2...</p>
                  <p className="text-ecto-green font-bold">&gt; [14:02] Job Completed. Local cache cleared.</p>
                </div>

                <div className="mt-6 rounded-lg bg-paper/10 p-3.5 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>Today's Total Printed</span>
                    <span className="text-lingot-lime">482 pages (₹1,048)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo QR Anchor / Interactive Simulator */}
      <section id="demo-qr" className="border-b-2 border-graphite/10 bg-paper px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <span className="rounded-xl border-2 border-lingot-lime bg-eel-light/30 px-3 py-1 text-xs font-bold text-midnight uppercase tracking-wider">
            Interactive Test Drive
          </span>
          <h2 className="mt-3 font-heading text-3xl font-black text-midnight sm:text-4xl">
            Scan or Click to Test the User Web App
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-charcoal sm:text-base">
            Scan this mock QR with your phone or click the button below to launch the live print interface.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center">
            <div className="rounded-2xl border-4 border-midnight bg-paper p-6 shadow-2xs">
              {/* Stylized QR placeholder with CtrlP center badge */}
              <div className="relative flex h-52 w-52 flex-col items-center justify-center rounded-xl border-2 border-graphite/20 bg-[#fafafa]">
                <QrCode className="h-40 w-40 text-midnight" />
                <div className="absolute flex h-10 w-10 items-center justify-center rounded-xl bg-ecto-green text-paper font-black text-sm">
                  P
                </div>
              </div>
              <div className="mt-4 font-mono text-xs font-bold text-midnight">
                SHOP ID: <span className="text-ecto-green">DEMO-CAMPUS-01</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-4 justify-center">
              <a
                href="http://localhost:3002"
                target="_blank"
                rel="noreferrer"
                className="btn-pressable-green inline-flex items-center gap-2 rounded-xl bg-ecto-green px-6 py-3.5 text-sm font-bold text-paper select-none"
              >
                <Smartphone className="h-4 w-4" />
                Open Mobile Web App Demo
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="border-b-2 border-graphite/10 bg-[#f9fdf5] px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="rounded-xl border-2 border-graphite/20 bg-paper px-3 py-1 text-xs font-bold text-charcoal uppercase tracking-wider">
              Common Questions
            </span>
            <h2 className="mt-3 font-heading text-3xl font-black text-midnight sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = faqOpen === idx
              return (
                <div
                  key={idx}
                  className="rounded-xl border-2 border-graphite/15 bg-paper transition-all overflow-hidden"
                >
                  <button
                    onClick={() => setFaqOpen(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-5 text-left font-bold text-midnight text-base cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 text-ecto-green shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-ash shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-graphite/10 px-5 pb-5 pt-3 text-sm font-medium leading-relaxed text-charcoal">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-midnight px-4 py-12 text-paper sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ecto-green text-paper">
                  <Printer className="h-4 w-4" />
                </div>
                <span className="font-heading text-xl font-black tracking-tight text-paper">
                  Ctrl<span className="text-lingot-lime">P</span>
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-paper/70 font-medium">
                Modernizing neighborhood and campus print shops with seamless, zero-wait cloud printing.
              </p>
            </div>

            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-lingot-lime">
                Product
              </div>
              <ul className="mt-3 space-y-2 text-xs font-medium text-paper/70">
                <li>
                  <a href="#how-it-works" className="hover:text-paper">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="#calculator" className="hover:text-paper">
                    Pricing Calculator
                  </a>
                </li>
                <li>
                  <a href="#demo-qr" className="hover:text-paper">
                    Scan Counter QR
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-lingot-lime">
                For Partners
              </div>
              <ul className="mt-3 space-y-2 text-xs font-medium text-paper/70">
                <li>
                  <a href="#shop-owners" className="hover:text-paper">
                    Shop Desktop Agent
                  </a>
                </li>
                <li>
                  <a href="#shop-owners" className="hover:text-paper">
                    Order QR Standee Kit
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-paper">
                    Partner Support
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-lingot-lime">
                Privacy & Trust
              </div>
              <ul className="mt-3 space-y-2 text-xs font-medium text-paper/70">
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-ecto-green" />
                  Auto-purged file lifecycle
                </li>
                <li>No WhatsApp data sharing</li>
                <li>End-to-end encrypted transfer</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-paper/10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-paper/60 font-medium gap-3">
            <p>© {new Date().getFullYear()} CtrlP Technologies Inc. All rights reserved.</p>
            <p>Designed with CtrlP Green Design System.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
