"use client"

import React from "react"
import { ConfigurableDocument } from "../../types/upload"
import { OrderPricingItem } from "../../types/order"
import { DocumentReviewCard } from "./document-review-card"
import { REVIEW_COPY } from "../../data/review-constants"

interface DocumentReviewListProps {
  documents: ConfigurableDocument[]
  pricingItems: OrderPricingItem[]
  onEditDocument: (documentId: string) => void
  onUpdateCopies: (documentId: string, copies: number) => void
  onDeleteDocument: (documentId: string) => void
}

export function DocumentReviewList({
  documents,
  pricingItems,
  onEditDocument,
  onUpdateCopies,
  onDeleteDocument,
}: DocumentReviewListProps) {
  const pricingMap = new Map(
    pricingItems.map((item) => [item.documentId, item])
  )

  return (
    <section
      aria-labelledby="documents-review-heading"
      className="overflow-hidden rounded-xl border border-graphite/15 bg-paper transition-colors"
    >
      {/* Clean Document Card Header */}
      <div className="flex items-center justify-between border-b border-graphite/10 bg-graphite/[0.02] px-4 py-3 sm:px-5">
        <h2
          id="documents-review-heading"
          className="text-body font-bold text-midnight"
        >
          {REVIEW_COPY.documentsSectionTitle}
        </h2>
        <span className="text-[13px] font-bold text-ash">
          {documents.length} {documents.length === 1 ? "document" : "documents"}
        </span>
      </div>

      {/* Itemized Checkout Rows with subtle separator matching UI theme */}
      <div className="divide-y divide-graphite/10">
        {documents.map((doc, index) => (
          <DocumentReviewCard
            key={doc.id}
            document={doc}
            itemIndex={index}
            pricingItem={pricingMap.get(doc.id)}
            onEdit={onEditDocument}
            onUpdateCopies={onUpdateCopies}
            onDelete={onDeleteDocument}
          />
        ))}
      </div>
    </section>
  )
}
