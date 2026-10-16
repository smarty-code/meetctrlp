"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { siteConfig } from "@/config/site-content"
import { Printer, Menu, X } from "lucide-react"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 border-b ${
        isScrolled
          ? "border-graphite/10 bg-paper/95 backdrop-blur-md py-3 shadow-2xs"
          : "border-graphite/5 bg-paper py-4"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand Wordmark */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-midnight select-none rounded-xl focus-visible:ring-2 focus-visible:ring-macaw-blue p-0.5"
          aria-label="MeetCtrlP Home"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-ecto-green text-paper transition-transform group-hover:scale-105">
            <Printer className="h-4 w-4" strokeWidth={2.3} />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight text-midnight">
            Meet<span className="text-ecto-green">CtrlP</span>
          </span>
        </Link>

        {/* Desktop Navigation (3-4 restrained links) */}
        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Primary Navigation"
        >
          {siteConfig.navigation.main.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[14px] font-medium text-charcoal transition-colors hover:text-midnight focus-visible:ring-2 focus-visible:ring-macaw-blue rounded-md px-1 py-0.5"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop Action CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={siteConfig.urls.forPrintShops}
            className="text-[13px] font-bold text-charcoal hover:text-midnight px-2 py-1 transition-colors"
          >
            For print shops
          </Link>
          <Link
            href={siteConfig.navigation.primaryCta.href}
            className="btn-pressable-green rounded-xl bg-ecto-green px-4 py-2 text-[13px] font-bold text-midnight select-none"
          >
            {siteConfig.navigation.primaryCta.label}
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-xl border border-graphite/20 p-2 text-midnight hover:bg-black/5 md:hidden"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Accessible Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-graphite/10 bg-paper px-6 py-5 md:hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <nav className="flex flex-col gap-3 font-medium text-charcoal">
            {siteConfig.navigation.main.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-base text-midnight border-b border-graphite/5"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-2.5">
              <Link
                href={siteConfig.navigation.primaryCta.href}
                onClick={() => setMobileMenuOpen(false)}
                className="btn-pressable-green rounded-xl bg-ecto-green py-3 text-center text-sm font-bold text-midnight"
              >
                {siteConfig.navigation.primaryCta.label}
              </Link>
              <Link
                href={siteConfig.urls.forPrintShops}
                onClick={() => setMobileMenuOpen(false)}
                className="btn-pressable-lime rounded-xl bg-paper py-3 text-center text-sm font-bold text-midnight"
              >
                For print shops
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
