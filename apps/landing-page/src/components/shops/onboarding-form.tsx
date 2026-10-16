"use client"

import React, { useState } from "react"
import { ArrowRight, CheckCircle2 } from "lucide-react"

export function OnboardingForm() {
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    ownerName: "",
    shopName: "",
    phone: "",
    city: "",
    printerModel: "",
    volume: "200-500",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-ecto-green bg-green-50/70 p-8 text-center animate-in fade-in duration-200">
        <CheckCircle2 className="h-10 w-10 text-ecto-green mx-auto" />
        <h3 className="mt-4 font-heading text-xl font-bold text-midnight">
          Inquiry Successfully Received
        </h3>
        <p className="mt-2 text-sm text-charcoal max-w-md mx-auto leading-relaxed">
          Thank you, {formData.ownerName || "Partner"}. Our onboarding specialist will review your printer model ({formData.printerModel || "standard driver"}) and reach out to {formData.phone || "your number"} within 24 hours.
        </p>
        <button
          onClick={() => {
            setSubmitted(false)
            setFormData({
              ownerName: "",
              shopName: "",
              phone: "",
              city: "",
              printerModel: "",
              volume: "200-500",
            })
          }}
          className="mt-6 text-xs font-bold text-midnight underline hover:text-ecto-green"
        >
          Submit another inquiry
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-graphite/20 bg-paper p-6 sm:p-10 shadow-xs">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="ownerName" className="block text-xs font-bold text-midnight uppercase tracking-wider">
              Shop Owner Name *
            </label>
            <input
              id="ownerName"
              type="text"
              required
              value={formData.ownerName}
              onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
              placeholder="e.g. Suresh Patel"
              className="mt-1.5 w-full rounded-xl border border-graphite/20 px-3.5 py-2.5 text-sm text-charcoal outline-none focus:border-macaw-blue focus:ring-1 focus:ring-macaw-blue"
            />
          </div>
          <div>
            <label htmlFor="shopName" className="block text-xs font-bold text-midnight uppercase tracking-wider">
              Shop Name *
            </label>
            <input
              id="shopName"
              type="text"
              required
              value={formData.shopName}
              onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
              placeholder="e.g. Balaji Stationery & Xerox"
              className="mt-1.5 w-full rounded-xl border border-graphite/20 px-3.5 py-2.5 text-sm text-charcoal outline-none focus:border-macaw-blue focus:ring-1 focus:ring-macaw-blue"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="block text-xs font-bold text-midnight uppercase tracking-wider">
              Phone Number (WhatsApp) *
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 98765 43210"
              className="mt-1.5 w-full rounded-xl border border-graphite/20 px-3.5 py-2.5 text-sm text-charcoal outline-none focus:border-macaw-blue focus:ring-1 focus:ring-macaw-blue"
            />
          </div>
          <div>
            <label htmlFor="city" className="block text-xs font-bold text-midnight uppercase tracking-wider">
              City & Area *
            </label>
            <input
              id="city"
              type="text"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="e.g. Koramangala, Bengaluru"
              className="mt-1.5 w-full rounded-xl border border-graphite/20 px-3.5 py-2.5 text-sm text-charcoal outline-none focus:border-macaw-blue focus:ring-1 focus:ring-macaw-blue"
            />
          </div>
        </div>

        <div>
          <label htmlFor="printerModel" className="block text-xs font-bold text-midnight uppercase tracking-wider">
            Main Printer Make & Model
          </label>
          <input
            id="printerModel"
            type="text"
            value={formData.printerModel}
            onChange={(e) => setFormData({ ...formData, printerModel: e.target.value })}
            placeholder="e.g. Canon imageRUNNER 2520, HP LaserJet MFP 436"
            className="mt-1.5 w-full rounded-xl border border-graphite/20 px-3.5 py-2.5 text-sm text-charcoal outline-none focus:border-macaw-blue focus:ring-1 focus:ring-macaw-blue"
          />
        </div>

        <div>
          <label htmlFor="volume" className="block text-xs font-bold text-midnight uppercase tracking-wider">
            Approximate Daily Print Volume
          </label>
          <select
            id="volume"
            value={formData.volume}
            onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-graphite/20 px-3.5 py-2.5 text-sm text-charcoal outline-none focus:border-macaw-blue focus:ring-1 focus:ring-macaw-blue bg-white"
          >
            <option value="under-200">Under 200 pages / day</option>
            <option value="200-500">200 – 500 pages / day</option>
            <option value="500-1500">500 – 1,500 pages / day</option>
            <option value="1500-plus">1,500+ pages / day (Campus hub)</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn-pressable-green w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-ecto-green px-8 py-3.5 text-base font-bold text-midnight select-none"
        >
          <span>Submit Partner Onboarding Inquiry</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
