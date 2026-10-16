import React from "react"
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { siteConfig } from "@/config/site-content"
import { OnboardingForm } from "@/components/shops/onboarding-form"
import {
  Laptop,
  Printer,
  Clock,
  Shield,
  ArrowRight,
  MessageSquare,
  HardDrive,
  Cpu,
} from "lucide-react"

export const metadata: Metadata = {
  title: "For Print Shops — MeetCtrlP",
  description:
    "Empower your print shop with CtrlP. Connect your Windows PC, receive structured customer print jobs without WhatsApp chaos, and spool to supported printers.",
}

export default function ForPrintShopsPage() {
  const shopFaqs = [
    {
      q: "What hardware or PC does my shop need?",
      a: "CtrlP runs on any standard Windows 10 or 11 PC connected to your existing printers via USB or local network. The desktop software is lightweight and starts automatically with Windows.",
    },
    {
      q: "Which printers are compatible?",
      a: "CtrlP utilizes your existing Windows print drivers (GDI / spooler API). Most standard multi-function and high-speed laser printers from HP, Canon, Epson, Brother, and Ricoh are supported. During onboarding, our team verifies your specific printer drivers.",
    },
    {
      q: "How do customers send prints to my shop?",
      a: "We provide a customized QR standee for your shop counter. Customers scan the QR on their phone, upload documents, select settings (duplex, B&W, copies), and pay or pay at counter. The order immediately rings into your desktop queue.",
    },
    {
      q: "How does pricing and payment collection work?",
      a: "You retain 100% control over your per-page rates. You set your prices for single-sided, double-sided, B&W, and color. Customers pay via UPI or cash at your counter.",
    },
    {
      q: "How do I get started?",
      a: "Submit the consultation request below or message us on WhatsApp. A MeetCtrlP onboarding specialist will schedule a guided setup session to inspect your printer drivers and provide your shop QR standee.",
    },
  ]

  return (
    <div className="min-h-screen bg-paper text-charcoal font-sans selection:bg-eel-light selection:text-midnight">
      <Header />

      <main>
        {/* Hero */}
        <section className="border-b border-graphite/10 bg-[#fbfdf9] py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-xl bg-eel-light px-3 py-1 text-xs font-bold text-midnight">
                <Laptop className="h-3.5 w-3.5 text-ecto-green" />
                <span>FOR PRINT SHOP OWNERS & OPERATORS</span>
              </div>

              <h1 className="mt-6 font-heading text-4xl font-black tracking-tight text-midnight sm:text-6xl">
                A quieter counter. <br />
                A structured print queue.
              </h1>

              <p className="mt-6 text-lg sm:text-xl font-normal leading-relaxed text-charcoal">
                Stop downloading WhatsApp files, asking customer phone numbers, and guessing duplex settings. CtrlP turns incoming rush into an orderly digital queue on your existing Windows PC.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#onboard-form"
                  className="btn-pressable-green inline-flex items-center gap-2 rounded-xl bg-ecto-green px-6 py-3.5 text-base font-bold text-midnight select-none"
                >
                  <span>Request Guided Onboarding</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <a
                  href={siteConfig.urls.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-pressable-lime inline-flex items-center gap-2 rounded-xl bg-paper px-6 py-3.5 text-base font-bold text-midnight select-none hover:bg-eel-light/30"
                >
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 3 Pillars for Print Shops */}
        <section className="border-b border-graphite/10 bg-paper py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="rounded-xl border border-graphite/15 p-7 bg-paper">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-midnight">
                  <Printer className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-bold text-midnight">
                  Direct Local Spooling
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal">
                  Our native Windows C# agent communicates directly with your print spooler. No more opening documents in Adobe Acrobat or Word just to click File &gt; Print.
                </p>
              </div>

              <div className="rounded-xl border border-graphite/15 p-7 bg-paper">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-midnight">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-bold text-midnight">
                  Cut 3 Minutes Per Customer
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal">
                  Customers configure their own page ranges, copies, and duplex settings on their phones while standing in line. When their turn arrives, the job is already verified and ready to print.
                </p>
              </div>

              <div className="rounded-xl border border-graphite/15 p-7 bg-paper">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-midnight">
                  <Shield className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-heading text-lg font-bold text-midnight">
                  Zero Virus Risk from Pendrives
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal">
                  Protect your shop computers from malware, shortcut viruses, and corrupted flash drives. All files arrive over secure HTTPS channels and auto-purge after completion.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Architecture Overview */}
        <section className="border-b border-graphite/10 bg-[#fafbfa] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-3xl">
              <span className="text-xs font-bold uppercase tracking-wider text-ash">
                HOW IT RUNS ON YOUR DESK
              </span>
              <h2 className="mt-3 font-heading text-3xl font-black text-midnight sm:text-4xl">
                Built specifically for Windows print shop PCs.
              </h2>
              <p className="mt-4 text-base text-charcoal leading-relaxed">
                We engineered the CtrlP Desktop application using a high-performance Tauri shell paired with a .NET 8 background driver service. It uses negligible CPU and memory, leaving your system free for your daily work.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-graphite/15 bg-paper p-6">
                <Cpu className="h-5 w-5 text-midnight" />
                <h4 className="mt-4 font-bold text-midnight text-sm">Lightweight Sidecar</h4>
                <p className="mt-1.5 text-xs text-charcoal">
                  Runs silently in the Windows system tray with authenticated local JSON-RPC named pipes.
                </p>
              </div>

              <div className="rounded-xl border border-graphite/15 bg-paper p-6">
                <Printer className="h-5 w-5 text-midnight" />
                <h4 className="mt-4 font-bold text-midnight text-sm">Automatic Queue Discovery</h4>
                <p className="mt-1.5 text-xs text-charcoal">
                  Automatically detects all local and network Windows print queues and hardware capabilities.
                </p>
              </div>

              <div className="rounded-xl border border-graphite/15 bg-paper p-6">
                <Clock className="h-5 w-5 text-midnight" />
                <h4 className="mt-4 font-bold text-midnight text-sm">7-Day Operating Hours</h4>
                <p className="mt-1.5 text-xs text-charcoal">
                  Set daily opening/closing times. Customers cannot submit orders when your shop is closed.
                </p>
              </div>

              <div className="rounded-xl border border-graphite/15 bg-paper p-6">
                <HardDrive className="h-5 w-5 text-midnight" />
                <h4 className="mt-4 font-bold text-midnight text-sm">Automated File Purge</h4>
                <p className="mt-1.5 text-xs text-charcoal">
                  Transient print documents are automatically deleted from the local disk cache upon completion.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Guided Onboarding Form */}
        <section id="onboard-form" className="border-b border-graphite/10 bg-paper py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-ash">
                JOIN THE PILOT PROGRAM
              </span>
              <h2 className="mt-3 font-heading text-3xl font-black text-midnight sm:text-4xl">
                Bring CtrlP to Your Shop Counter
              </h2>
              <p className="mt-4 text-sm sm:text-base text-charcoal leading-relaxed">
                {siteConfig.partner.guidedNote}
              </p>
            </div>

            <div className="mt-12">
              <OnboardingForm />
            </div>
          </div>
        </section>

        {/* Shop Owner FAQs */}
        <section className="border-b border-graphite/10 bg-[#fafbfa] py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="font-heading text-2xl sm:text-3xl font-black text-midnight text-center">
              Frequently Asked Questions for Print Shops
            </h2>

            <div className="mt-12 space-y-4">
              {shopFaqs.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-xl border border-graphite/15 bg-paper p-6"
                >
                  <h3 className="font-heading text-base sm:text-lg font-bold text-midnight">
                    {faq.q}
                  </h3>
                  <p className="mt-2 text-sm text-charcoal leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
