"use client"

import React from "react"
import { AlertTriangle, RefreshCw, UploadCloud } from "lucide-react"
import { REVIEW_COPY } from "../../data/review-constants"

interface ReviewErrorStateProps {
  title?: string
  description?: string
  isEmpty?: boolean
  onRetry?: () => void
  onAddDocuments?: () => void
}

export function ReviewErrorState({
  title = REVIEW_COPY.errorTitle,
  description = REVIEW_COPY.errorDescription,
  isEmpty = false,
  onRetry,
  onAddDocuments,
}: ReviewErrorStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border-2 border-graphite/20 bg-eel-light text-midnight">
        {isEmpty ? (
          <UploadCloud className="size-7 stroke-[2.5]" />
        ) : (
          <AlertTriangle className="size-7 stroke-[2.5] text-midnight" />
        )}
      </div>

      <h2 className="mt-4 text-heading-sm font-bold text-midnight">
        {isEmpty ? REVIEW_COPY.emptyTitle : title}
      </h2>

      <p className="mt-2 text-body text-charcoal">
        {isEmpty ? REVIEW_COPY.emptyDescription : description}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {isEmpty && onAddDocuments && (
          <button
            type="button"
            onClick={onAddDocuments}
            className="flex items-center gap-2 rounded-xl bg-ecto-green px-5 py-2.5 text-body font-bold text-midnight transition-all hover:bg-ecto-green/90 active:scale-95"
          >
            <UploadCloud className="size-4" />
            <span>{REVIEW_COPY.addDocumentsCTA}</span>
          </button>
        )}

        {!isEmpty && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 rounded-xl border-2 border-graphite/40 bg-paper px-5 py-2.5 text-body font-bold text-midnight transition-all hover:bg-graphite/10 active:scale-95"
          >
            <RefreshCw className="size-4" />
            <span>{REVIEW_COPY.retryCTA}</span>
          </button>
        )}
      </div>
    </div>
  )
}
