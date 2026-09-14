'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PreviewPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  documentCount?: number;
  documentIndex?: number;
  documents?: { id: string; name: string }[];
  selectedDocId?: string;
  onSelectDocument?: (id: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function PreviewPagination({
  currentPage,
  totalPages,
  onPageChange,
  documentCount = 1,
  documentIndex = 1,
  documents = [],
  selectedDocId = '',
  onSelectDocument,
  onPrev,
  onNext,
}: PreviewPaginationProps) {
  const isMultipleDocs = documentCount > 1;
  const isMultiplePages = totalPages > 1;

  const canGoPrev = currentPage > 1 || documentIndex > 1;
  const canGoNext = currentPage < totalPages || documentIndex < documentCount;

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    } else if (onPrev) {
      onPrev();
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    } else if (onNext) {
      onNext();
    }
  };

  return (
    <div className="flex flex-col items-center select-none mt-2">
      {/* 1. Pill & Dot Indicators matching previous design and color */}
      <div className="flex items-center justify-center gap-2 flex-wrap max-w-xs" aria-label="Select item">
        {isMultipleDocs ? (
          // If multiple documents, render a dot for each document with active green pill
          documents.map((doc, idx) => {
            const isSelected = doc.id ? doc.id === selectedDocId : idx === documentIndex - 1;
            return (
              <button
                key={doc.id || idx}
                type="button"
                aria-label={`Document ${idx + 1}`}
                aria-pressed={isSelected}
                onClick={() => onSelectDocument?.(doc.id)}
                className={`h-2.5 rounded-full border border-graphite transition-all cursor-pointer ${
                  isSelected ? 'w-8 bg-ecto-green' : 'w-2.5 bg-paper hover:bg-graphite/10'
                }`}
              />
            );
          })
        ) : isMultiplePages ? (
          // If 1 document with multiple pages, render a dot for each page with active green pill
          Array.from({ length: totalPages }).map((_, idx) => {
            const isSelected = idx === currentPage - 1;
            return (
              <button
                key={idx}
                type="button"
                aria-label={`Page ${idx + 1}`}
                aria-pressed={isSelected}
                onClick={() => onPageChange(idx + 1)}
                className={`h-2.5 rounded-full border border-graphite transition-all cursor-pointer ${
                  isSelected ? 'w-8 bg-ecto-green' : 'w-2.5 bg-paper hover:bg-graphite/10'
                }`}
              />
            );
          })
        ) : (
          // Default single active pill
          <span className="w-8 h-2.5 rounded-full border border-graphite bg-ecto-green" />
        )}
      </div>

      {/* 2. Circular Green Outline Buttons with Center Text */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Previous"
          onClick={handlePrev}
          disabled={!canGoPrev}
          className="size-8 sm:size-8.5 rounded-full border border-ecto-green bg-paper text-graphite flex items-center justify-center hover:bg-eel-light active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
        >
          <ChevronLeft className="size-4 stroke-[2.2]" />
        </button>

        <span className="text-xs sm:text-sm font-bold text-graphite/80 tracking-tight">
          Preview page {currentPage} of {totalPages}
          {documentCount > 1 && (
            <span className="text-ash font-medium ml-1.5">
              (Doc {documentIndex}/{documentCount})
            </span>
          )}
        </span>

        <button
          type="button"
          aria-label="Next"
          onClick={handleNext}
          disabled={!canGoNext}
          className="size-8 sm:size-8.5 rounded-full border border-ecto-green bg-paper text-graphite flex items-center justify-center hover:bg-eel-light active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
        >
          <ChevronRight className="size-4 stroke-[2.2]" />
        </button>
      </div>
    </div>
  );
}
