"use client"

import React from "react"
import { ArrowLeft } from "lucide-react"
import { REVIEW_COPY } from "../../data/review-constants"

interface ReviewHeaderProps {
  onBack: () => void
  title?: string
}

export function ReviewHeader({
  onBack,
  title = REVIEW_COPY.headerTitle,
}: ReviewHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b-2 border-graphite/20 bg-paper/95 px-4 backdrop-blur-xs sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={REVIEW_COPY.backButtonAria}
          className="flex size-10 items-center justify-center rounded-xl border-2 border-graphite/30 bg-paper text-midnight transition-colors hover:border-graphite hover:bg-eel-light/30 focus-visible:ring-2 focus-visible:ring-macaw-blue focus-visible:outline-hidden"
        >
          <ArrowLeft className="size-5 stroke-[2.5]" />
        </button>
        <h1 className="text-heading-sm font-bold tracking-heading-sm text-midnight">
          {title}
        </h1>
      </div>
    </header>
  )
}
