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
}

export function DocumentReviewList({
  documents,
  pricingItems,
  onEditDocument,
}: DocumentReviewListProps) {
  const pricingMap = new Map(
    pricingItems.map((item) => [item.documentId, item])
  )

  return (
    <section
      aria-labelledby="documents-review-heading"
      className="overflow-hidden rounded-xl border-2 border-graphite/20 bg-paper transition-colors"
    >
      {/* Checkout Card Header */}
      <div className="flex items-center justify-between border-b-2 border-graphite/10 bg-paper px-4 py-3.5 sm:px-5">
        <h2
          id="documents-review-heading"
          className="text-body font-bold text-midnight"
        >
          {REVIEW_COPY.documentsSectionTitle}
        </h2>
        <span className="rounded-full bg-graphite/10 px-2.5 py-0.5 text-caption font-bold text-charcoal">
          {documents.length} {documents.length === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Itemized Checkout Rows */}
      <div className="divide-y-2 divide-graphite/10">
        {documents.map((doc, index) => (
          <DocumentReviewCard
            key={doc.id}
            document={doc}
            itemIndex={index}
            pricingItem={pricingMap.get(doc.id)}
            onEdit={onEditDocument}
          />
        ))}
      </div>
    </section>
  )
}
