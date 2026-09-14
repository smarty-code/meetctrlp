import React, { useRef } from 'react';
import { customizeCopy } from '../../data/customize-repository';
import { ConfigurableDocument } from '../../types/upload';
import { PreviewPagination } from './preview-pagination';
import { PreviewCarousel, PreviewCarouselHandle } from './preview-carousel';

interface DocumentSelectorProps {
  documents: ConfigurableDocument[];
  selectedId: string;
  previewPage: number;
  onSelect: (id: string) => void;
  onMove?: (offset: number) => void;
  onPreviewPage: (page: number) => void;
  onRemove?: () => void;
  onPageCountDetected?: (docId: string, count: number) => void;
}

export function DocumentSelector({
  documents,
  selectedId,
  previewPage,
  onSelect,
  onMove,
  onPreviewPage,
  onRemove,
  onPageCountDetected,
}: DocumentSelectorProps) {
  const carouselRef = useRef<PreviewCarouselHandle>(null);
  const document = documents.find((item) => item.id === selectedId) ?? documents[0];
  const position = documents.findIndex((item) => item.id === document.id) + 1;

  const handleSwipeLeft = () => {
    if (previewPage < document.pageCount) {
      onPreviewPage(previewPage + 1);
    } else if (position < documents.length && onMove) {
      onMove(1);
    }
  };

  const handleSwipeRight = () => {
    if (previewPage > 1) {
      onPreviewPage(previewPage - 1);
    } else if (position > 1 && onMove) {
      onMove(-1);
    }
  };

  const handlePaginationPrev = () => {
    if (carouselRef.current) {
      carouselRef.current.slideRight();
    } else {
      handleSwipeRight();
    }
  };

  const handlePaginationNext = () => {
    if (carouselRef.current) {
      carouselRef.current.slideLeft();
    } else {
      handleSwipeLeft();
    }
  };

  return (
    <section
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-4 sm:py-6"
      aria-label={customizeCopy.preview}
    >
      {/* Smooth Animated Carousel with Non-blurred Side Peeks & Gesture Tracking */}
      <PreviewCarousel
        ref={carouselRef}
        documents={documents}
        selectedId={selectedId}
        previewPage={previewPage}
        onSelectDocument={(id) => {
          onSelect(id);
          onPreviewPage(1);
        }}
        onPreviewPage={onPreviewPage}
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        onRemove={onRemove}
        onPageCountDetected={onPageCountDetected}
      />

      {/* Pagination Controls matching repository styling (Pill/Dots & Circular Green Buttons) */}
      <PreviewPagination
        currentPage={previewPage}
        totalPages={document.pageCount}
        onPageChange={onPreviewPage}
        documentCount={documents.length}
        documentIndex={position}
        documents={documents}
        selectedDocId={selectedId}
        onSelectDocument={(id) => {
          onSelect(id);
          onPreviewPage(1);
        }}
        onPrev={handlePaginationPrev}
        onNext={handlePaginationNext}
      />
    </section>
  );
}