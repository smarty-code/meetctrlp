"use client"

import React from "react"
import { Minus, Plus, X } from "lucide-react"
import { ConfigurableDocument } from "../../types/upload"
import { OrderPricingItem } from "../../types/order"
import { DocumentThumbnail } from "./document-thumbnail"
import {
  formatColorMode,
  formatPageSelectionSummary,
  formatPaperSize,
} from "../../lib/review-formatters"
import { formatCurrency } from "../../lib/currency"
import { REVIEW_COPY } from "../../data/review-constants"

interface DocumentReviewCardProps {
  document: ConfigurableDocument
  itemIndex: number
  pricingItem?: OrderPricingItem
  onEdit: (documentId: string) => void
  onUpdateCopies: (documentId: string, copies: number) => void
  onDelete: (documentId: string) => void
}

export function DocumentReviewCard({
  document,
  itemIndex,
  pricingItem,
  onEdit,
  onUpdateCopies,
  onDelete,
}: DocumentReviewCardProps) {
  const { configuration } = document
  const pageSelectionText = formatPageSelectionSummary(
    configuration.pageSelection,
    document.pageCount
  )
  const isSelectedPages = pageSelectionText !== REVIEW_COPY.allPages

  const effectivePages =
    configuration.pageSelection?.mode === "selected" &&
    configuration.pageSelection.pages.length > 0
      ? configuration.pageSelection.pages.length
      : Math.max(1, document.pageCount || 1)

  const itemPrice = pricingItem?.totalAmount ?? 0

  return (
    <div
      role="button"
      tabIndex={0}
      title={`Click to configure ${document.name}`}
      onClick={() => onEdit(document.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onEdit(document.id)
        }
      }}
      className="group relative flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-graphite/[0.03] sm:gap-4 sm:p-4 cursor-pointer focus-visible:outline-hidden focus-visible:bg-graphite/[0.05]"
    >
      {/* Left: Thumbnail with Cross Delete Button at Top-Left Corner */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(document.id)
          }}
          aria-label={`Remove item ${itemIndex + 1}`}
          title="Remove document"
          className="absolute -top-1.5 -left-1.5 z-10 flex size-5.5 items-center justify-center rounded-full border border-graphite/25 bg-paper text-charcoal shadow-xs transition-all hover:border-destructive hover:bg-destructive hover:text-paper active:scale-90 cursor-pointer"
        >
          <X className="size-3 stroke-[2.5]" />
        </button>

        <DocumentThumbnail document={document} />
      </div>

      {/* Middle: "<copies> copies × <pages> pages" Headline + Configuration Subline */}
      <div className="min-w-0 flex-1">
        {/* Headline: replaces document name with copies × pages */}
        <p className="text-[14px] font-bold text-midnight leading-snug sm:text-[15px] group-hover:text-charcoal transition-colors">
          {configuration.copies} {configuration.copies === 1 ? "copy" : "copies"}{" "}
          × {effectivePages} {effectivePages === 1 ? "page" : "pages"}
        </p>

        {/* Subline: Color mode, Paper size, page range */}
        <p className="mt-0.5 text-[12px] font-medium text-ash leading-tight">
          <span>{formatColorMode(configuration.colorMode)}</span>
          <span className="mx-1.5 text-ash/60">·</span>
          <span>{formatPaperSize(configuration.paperSize)}</span>
          {isSelectedPages && (
            <>
              <span className="mx-1.5 text-ash/60">·</span>
              <span className="text-macaw-blue font-semibold">
                {pageSelectionText}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Right: Horizontally aligned Stepper & Price */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center gap-2.5 sm:gap-3"
      >
        {/* Stepper controls */}
        <div className="flex items-center rounded-lg border border-graphite/20 bg-graphite/5 p-0.5">
          <button
            type="button"
            aria-label={`Decrease copies for item ${itemIndex + 1}`}
            onClick={(e) => {
              e.stopPropagation()
              onUpdateCopies(document.id, configuration.copies - 1)
            }}
            disabled={configuration.copies <= 1}
            className="flex size-6 items-center justify-center rounded-md border border-graphite/20 bg-paper text-midnight transition-colors hover:bg-graphite/10 disabled:pointer-events-none disabled:opacity-30 active:scale-95 cursor-pointer"
          >
            <Minus className="size-3 stroke-[2.5]" />
          </button>
          <span className="w-6 text-center font-heading text-[12px] font-bold text-midnight select-none sm:text-[13px]">
            {configuration.copies}
          </span>
          <button
            type="button"
            aria-label={`Increase copies for item ${itemIndex + 1}`}
            onClick={(e) => {
              e.stopPropagation()
              onUpdateCopies(document.id, configuration.copies + 1)
            }}
            className="flex size-6 items-center justify-center rounded-md border border-graphite/20 bg-paper text-midnight transition-colors hover:bg-graphite/10 active:scale-95 cursor-pointer"
          >
            <Plus className="size-3 stroke-[2.5]" />
          </button>
        </div>

        {/* Line-item Price */}
        <span className="min-w-[50px] text-right text-[14px] font-extrabold text-midnight sm:text-[15px] leading-none">
          {formatCurrency(itemPrice)}
        </span>
      </div>
    </div>
  )
}
