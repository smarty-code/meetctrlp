"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { DocumentSummary } from "../../types/tracking";
import { TRACKING_COPY } from "../../data/tracking-constants";

interface OrderCompactSummaryProps {
  summary: DocumentSummary;
}

export function OrderCompactSummary({ summary }: OrderCompactSummaryProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <section
      aria-labelledby="summary-heading"
      className="space-y-3 rounded-xl border-2 border-graphite/20 bg-paper p-5 sm:p-6"
    >
      <div className="flex items-center justify-between">
        <span
          id="summary-heading"
          className="text-caption font-bold tracking-wider text-ash uppercase"
        >
          {TRACKING_COPY.documentSummaryTitle}
        </span>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex cursor-pointer items-center gap-1 text-caption font-bold text-ecto-green hover:underline"
        >
          <span>
            {isExpanded ? TRACKING_COPY.hideDetails : TRACKING_COPY.showDetails}
          </span>
          {isExpanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between text-body">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-ash" />
          <span className="font-bold text-midnight">
            {TRACKING_COPY.documentsCountLabel(
              summary.totalDocuments,
              summary.totalPages,
            )}
          </span>
        </div>
        <span className="text-caption font-bold text-ash">
          {summary.totalCopies} {summary.totalCopies === 1 ? "copy" : "copies"}
        </span>
      </div>

      {isExpanded && summary.items.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-graphite/10 pt-3">
          {summary.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg bg-graphite/5 px-3 py-2 text-caption"
            >
              <div className="flex min-w-0 items-center gap-2 pr-2">
                <FileText className="size-3.5 shrink-0 text-ash" />
                <span className="truncate font-bold text-midnight">
                  {item.name}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2 font-medium text-ash">
                <span>{item.pages} pp</span>
                <span>•</span>
                <span className="uppercase">{item.colorMode}</span>
                <span>•</span>
                <span>{item.paperSize}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
