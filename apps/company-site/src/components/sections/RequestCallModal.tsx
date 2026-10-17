"use client"

import React, { useState } from "react"
import Link from "next/link"
import { siteCopy } from "@/content/copy"
import { trackEvent } from "@/lib/analytics"

interface RequestCallModalProps {
  isOpen: boolean
  onClose: () => void
}

export function RequestCallModal({ isOpen, onClose }: RequestCallModalProps) {
  const { form } = siteCopy.contact
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [shopName, setShopName] = useState("")
  const [honeypot, setHoneypot] = useState("") // Protection against bots

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate phone: 10 digits with optional +91
    const cleanPhone = phone.replace(/[\s\-()]/g, "")
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/
    if (!phoneRegex.test(cleanPhone)) {
      setStatus("error")
      setErrorMessage("Please enter a valid 10-digit phone number.")
      return
    }

    setLoading(true)
    setStatus("idle")
    setErrorMessage("")

    try {
      const res = await fetch("/api/request-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          shopName: shopName.trim(),
          website_hp: honeypot, // Honeypot trap
        }),
      })

      if (res.ok) {
        setStatus("success")
        trackEvent({ name: "request_call_submit" })
        setName("")
        setPhone("")
        setShopName("")
      } else {
        const data = await res.json().catch(() => ({}))
        setStatus("error")
        setErrorMessage(data.error || form.errorMsg)
      }
    } catch {
      setStatus("error")
      setErrorMessage(form.errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-call-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-surface rounded-3xl p-6 sm:p-8 border border-neutral-200/80 shadow-card text-ink">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full border border-neutral-200/80 flex items-center justify-center text-ink-soft hover:bg-surface-sunken hover:text-ink transition-colors"
          aria-label="Close dialog"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
            <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
          </svg>
        </button>

        <h3 id="request-call-title" className="font-display text-2xl sm:text-3xl font-bold text-ink">
          {form.title}
        </h3>

        {status === "success" ? (
          <div className="mt-6 p-4 rounded-2xl bg-chip-paid-bg border border-chip-paid-fg/20 text-chip-paid-fg text-center">
            <p className="font-bold text-base">{form.successMsg}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-5 py-2 rounded-full text-xs font-bold bg-lime text-ink"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            {/* Honeypot field (hidden from real users) */}
            <div className="hidden" aria-hidden="true">
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {/* Name */}
            <div>
              <label htmlFor="user-name" className="block text-xs font-bold text-ink-soft mb-1">
                {form.nameLabel} <span className="text-lime-deep">*</span>
              </label>
              <input
                id="user-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={form.namePlaceholder}
                className="w-full px-4 py-2.5 rounded-xl border border-line bg-surface-sunken text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="user-phone" className="block text-xs font-bold text-ink-soft mb-1">
                {form.phoneLabel} <span className="text-lime-deep">*</span>
              </label>
              <input
                id="user-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={form.phonePlaceholder}
                className="w-full px-4 py-2.5 rounded-xl border border-line bg-surface-sunken text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>

            {/* Shop Name */}
            <div>
              <label htmlFor="user-shop" className="block text-xs font-bold text-ink-soft mb-1">
                {form.shopNameLabel}
              </label>
              <input
                id="user-shop"
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder={form.shopNamePlaceholder}
                className="w-full px-4 py-2.5 rounded-xl border border-line bg-surface-sunken text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-lime"
              />
            </div>

            {/* Error Message */}
            {status === "error" && (
              <p role="alert" className="text-xs font-semibold text-chip-error-fg bg-chip-error-bg p-2.5 rounded-xl border border-chip-error-fg/20">
                {errorMessage}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-3 rounded-full font-bold bg-lime text-ink text-sm shadow-xs hover:brightness-95 active:scale-95 transition-all disabled:opacity-60"
            >
              {loading ? form.submittingBtn : form.submitBtn}
            </button>

            {/* Privacy notice */}
            <p className="text-[11px] text-ink-faint text-center mt-1">
              {form.privacyNotice}{" "}
              <Link href="/privacy" className="underline hover:text-ink">
                {form.privacyLinkText}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
