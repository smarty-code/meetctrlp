"use client"

import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PreviewPaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  documentCount?: number
  documentIndex?: number
  documents?: { id: string; name: string }[]
  selectedDocId?: string
  onSelectDocument?: (id: string) => void
  onPrev?: () => void
  onNext?: () => void
}

export function PreviewPagination({
  currentPage,
  totalPages,
  onPageChange,
  documentCount = 1,
  documentIndex = 1,
  documents = [],
  selectedDocId = "",
  onSelectDocument,
  onPrev,
  onNext,
}: PreviewPaginationProps) {
  const isMultipleDocs = documentCount > 1
  const isMultiplePages = totalPages > 1

  const canGoPrev = currentPage > 1 || documentIndex > 1
  const canGoNext = currentPage < totalPages || documentIndex < documentCount

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    } else if (onPrev) {
      onPrev()
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    } else if (onNext) {
      onNext()
    }
  }

  return (
    <div className="mt-2 flex flex-col items-center select-none">
      {/* 1. Pill & Dot Indicators matching previous design and color */}
      <div
        className="flex max-w-xs flex-wrap items-center justify-center gap-2"
        aria-label="Select item"
      >
        {isMultipleDocs ? (
          // If multiple documents, render a dot for each document with active green pill
          documents.map((doc, idx) => {
            const isSelected = doc.id
              ? doc.id === selectedDocId
              : idx === documentIndex - 1
            return (
              <button
                key={doc.id || idx}
                type="button"
                aria-label={`Document ${idx + 1}`}
                aria-pressed={isSelected}
                onClick={() => onSelectDocument?.(doc.id)}
                className={`h-2.5 cursor-pointer rounded-full border border-graphite transition-all ${
                  isSelected
                    ? "w-8 bg-ecto-green"
                    : "w-2.5 bg-paper hover:bg-graphite/10"
                }`}
              />
            )
          })
        ) : isMultiplePages ? (
          // If 1 document with multiple pages, render a dot for each page with active green pill
          Array.from({ length: totalPages }).map((_, idx) => {
            const isSelected = idx === currentPage - 1
            return (
              <button
                key={idx}
                type="button"
                aria-label={`Page ${idx + 1}`}
                aria-pressed={isSelected}
                onClick={() => onPageChange(idx + 1)}
                className={`h-2.5 cursor-pointer rounded-full border border-graphite transition-all ${
                  isSelected
                    ? "w-8 bg-ecto-green"
                    : "w-2.5 bg-paper hover:bg-graphite/10"
                }`}
              />
            )
          })
        ) : (
          // Default single active pill
          <span className="h-2.5 w-8 rounded-full border border-graphite bg-ecto-green" />
        )}
      </div>

      {/* 2. Circular Green Outline Buttons with Center Text */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Previous"
          onClick={handlePrev}
          disabled={!canGoPrev}
          className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-ecto-green bg-paper text-graphite shadow-2xs transition-all hover:bg-eel-light active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:size-8.5"
        >
          <ChevronLeft className="size-4 stroke-[2.2]" />
        </button>

        <span className="text-xs font-bold tracking-tight text-graphite/80 sm:text-sm">
          Preview page {currentPage} of {totalPages}
          {documentCount > 1 && (
            <span className="ml-1.5 font-medium text-ash">
              (Doc {documentIndex}/{documentCount})
            </span>
          )}
        </span>

        <button
          type="button"
          aria-label="Next"
          onClick={handleNext}
          disabled={!canGoNext}
          className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-ecto-green bg-paper text-graphite shadow-2xs transition-all hover:bg-eel-light active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:size-8.5"
        >
          <ChevronRight className="size-4 stroke-[2.2]" />
        </button>
      </div>
    </div>
  )
}
