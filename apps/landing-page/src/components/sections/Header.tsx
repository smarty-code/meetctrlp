"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { siteConfig } from "@/content/site-config"
import { siteCopy } from "@/content/copy"
import { trackEvent } from "@/lib/analytics"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { header } = siteCopy

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false)
      }
    }
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
      window.addEventListener("keydown", handleKeyDown)
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [mobileMenuOpen])

  return (
    <>
      {/* Skip to Content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-lime focus:text-ink focus:rounded-lg focus:font-bold focus:shadow-md"
      >
        {header.skipToContent}
      </a>

      {/* Main Sticky Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-bg/85 backdrop-blur-md border-b border-line shadow-xs"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-12 h-16 sm:h-[72px] flex items-center justify-between">
          {/* Logo Wordmark */}
          <Link
            href="/"
            className="text-xl sm:text-2xl font-display tracking-tight text-ink hover:opacity-85 transition-opacity"
            onClick={() => trackEvent({ name: "nav_click", properties: { label: "logo" } })}
          >
            {header.wordmark}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-soft">
            {header.navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-ink transition-colors"
                onClick={() => trackEvent({ name: "nav_click", properties: { label: item.label } })}
              >
                {item.label}
              </Link>
            ))}

            {/* Flagged Journey Link */}
            {siteConfig.features.showJourney && (
              <Link
                href={header.journeyItem.href}
                className="hover:text-ink transition-colors"
                onClick={() =>
                  trackEvent({ name: "nav_click", properties: { label: header.journeyItem.label } })
                }
              >
                {header.journeyItem.label}
              </Link>
            )}
          </nav>

          {/* Action CTAs & Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <Link
              href={header.primaryCta.href}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-lime text-ink hover:brightness-95 active:scale-95 transition-all shadow-xs"
              onClick={() =>
                trackEvent({ name: "cta_explore_click", properties: { location: "header" } })
              }
            >
              {header.primaryCta.label}
            </Link>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-ink hover:bg-surface-sunken transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={header.mobileMenu.openLabel}
              aria-expanded={mobileMenuOpen}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
                <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
                <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Sheet */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
          className="fixed inset-0 z-[100] bg-bg flex flex-col justify-between p-6 sm:p-8 animate-in fade-in duration-200"
        >
          {/* Header inside Sheet */}
          <div className="flex items-center justify-between border-b border-line pb-4">
            <span className="text-xl font-display text-ink">{header.wordmark}</span>
            <button
              type="button"
              className="p-2 rounded-lg text-ink hover:bg-surface-sunken"
              onClick={() => setMobileMenuOpen(false)}
              aria-label={header.mobileMenu.closeLabel}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
                <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Links list */}
          <div className="flex flex-col gap-6 my-auto text-2xl font-display text-ink">
            {header.navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-lime-deep transition-colors"
                onClick={() => {
                  trackEvent({ name: "nav_click", properties: { label: item.label } })
                  setMobileMenuOpen(false)
                }}
              >
                {item.label}
              </Link>
            ))}

            {siteConfig.features.showJourney && (
              <Link
                href={header.journeyItem.href}
                className="hover:text-lime-deep transition-colors"
                onClick={() => {
                  trackEvent({ name: "nav_click", properties: { label: header.journeyItem.label } })
                  setMobileMenuOpen(false)
                }}
              >
                {header.journeyItem.label}
              </Link>
            )}
          </div>

          {/* Sheet Footer with Primary CTA */}
          <div className="pt-6 border-t border-line flex flex-col gap-3">
            <Link
              href={header.primaryCta.href}
              className="w-full py-3.5 rounded-full text-center font-semibold bg-lime text-ink text-base shadow-xs"
              onClick={() => {
                trackEvent({ name: "cta_explore_click", properties: { location: "header" } })
                setMobileMenuOpen(false)
              }}
            >
              {header.primaryCta.label}
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
