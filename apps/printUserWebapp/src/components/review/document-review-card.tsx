"use client"

import React from "react"
import { Pencil } from "lucide-react"
import { ConfigurableDocument } from "../../types/upload"
import { OrderPricingItem } from "../../types/order"
import { DocumentThumbnail } from "./document-thumbnail"
import {
  formatColorMode,
  formatCopies,
  formatPageCount,
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
}

export function DocumentReviewCard({
  document,
  itemIndex,
  pricingItem,
  onEdit,
}: DocumentReviewCardProps) {
  const { configuration } = document
  const pageSelectionText = formatPageSelectionSummary(
    configuration.pageSelection,
    document.pageCount
  )
  const isSelectedPages = pageSelectionText !== REVIEW_COPY.allPages

  const itemPrice = pricingItem?.totalAmount ?? 0

  return (
    <div className="flex items-center justify-between gap-3.5 p-4 transition-colors hover:bg-graphite/5 sm:p-5">
      {/* Left: Thumbnail Preview */}
      <DocumentThumbnail document={document} />

      {/* Middle: Key Print Information (Pages, Copies, Color, Size) */}
      <div className="min-w-0 flex-1">
        {/* Pages & Copies as Primary Hierarchy */}
        <div className="flex items-center gap-1.5 text-body font-bold text-midnight">
          <span>{formatPageCount(document.pageCount)}</span>
          <span aria-hidden="true" className="text-ash font-normal">
            ·
          </span>
          <span>{formatCopies(configuration.copies)}</span>
        </div>

        {/* Configuration Tags: Color, Paper Size, Selected Page Range */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-lg border border-graphite/20 bg-paper px-2 py-0.5 text-caption font-bold text-midnight">
            {formatColorMode(configuration.colorMode)}
          </span>
          <span className="rounded-lg border border-graphite/20 bg-paper px-2 py-0.5 text-caption font-bold text-midnight">
            {formatPaperSize(configuration.paperSize)}
          </span>
          {isSelectedPages && (
            <span className="rounded-lg border border-macaw-blue/40 bg-macaw-blue/10 px-2 py-0.5 text-caption font-bold text-midnight">
              {pageSelectionText}
            </span>
          )}
        </div>
      </div>

      {/* Right: Price & Edit CTA (Stacked like e-commerce checkout) */}
      <div className="flex flex-col items-end justify-between gap-2 self-stretch shrink-0 py-0.5">
        <span className="text-body font-bold text-midnight sm:text-[16px]">
          {formatCurrency(itemPrice)}
        </span>

        <button
          type="button"
          onClick={() => onEdit(document.id)}
          aria-label={`Edit print settings for item ${itemIndex + 1}`}
          className="inline-flex items-center gap-1 rounded-lg border border-macaw-blue px-2.5 py-1 text-caption font-bold text-midnight transition-all hover:bg-macaw-blue/10 focus-visible:ring-2 focus-visible:ring-macaw-blue focus-visible:outline-hidden"
        >
          <Pencil className="size-3 stroke-[2.5]" />
          <span>Edit</span>
        </button>
      </div>
    </div>
  )
}
