'use client';

import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ConfigurableDocument } from '../../types/upload';
import { DocumentPreview } from './document-preview';

export interface PreviewCarouselHandle {
  slideLeft: () => void;
  slideRight: () => void;
}

interface PreviewCarouselProps {
  documents: ConfigurableDocument[];
  selectedId: string;
  previewPage: number;
  onSelectDocument: (id: string) => void;
  onPreviewPage: (page: number) => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onRemove?: () => void;
  onPageCountDetected?: (docId: string, count: number) => void;
}

export const PreviewCarousel = forwardRef<PreviewCarouselHandle, PreviewCarouselProps>(
  function PreviewCarousel(
    {
      documents,
      selectedId,
      previewPage,
      onSelectDocument,
      onPreviewPage,
      onSwipeLeft,
      onSwipeRight,
      onRemove,
      onPageCountDetected,
    },
    ref
  ) {
    const activeDoc = documents.find((item) => item.id === selectedId) ?? documents[0];
    const currentIndex = documents.findIndex((item) => item.id === activeDoc.id);

    // Track drag offset and transition states
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Refs to track gestures without stale closures
    const startXRef = useRef<number | null>(null);
    const startYRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const axisLockedRef = useRef<'x' | 'y' | null>(null);
    const wheelLockRef = useRef(false);

    // Determine side peek documents (only when documents > 1)
    const hasMultipleDocs = documents.length > 1;
    const prevIndex = hasMultipleDocs
      ? (currentIndex - 1 + documents.length) % documents.length
      : -1;
    const nextIndex = hasMultipleDocs ? (currentIndex + 1) % documents.length : -1;

    const prevDoc = prevIndex >= 0 ? documents[prevIndex] : null;
    const nextDoc = nextIndex >= 0 ? documents[nextIndex] : null;

    // Trigger smooth animated transition in a given direction
    const triggerSlide = useCallback(
      (direction: 'left' | 'right', callback: () => void) => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setIsDragging(false);

        // Slide distance: 160px gives a punchy, smooth card transition
        const targetOffset = direction === 'left' ? -160 : 160;
        setDragX(targetOffset);

        setTimeout(() => {
          callback();
          // Reset drag position instantly with transition disabled briefly
          setDragX(0);
          setTimeout(() => {
            setIsTransitioning(false);
          }, 50);
        }, 220);
      },
      [isTransitioning]
    );

    // Expose slide methods to parent (e.g. for pagination buttons)
    useImperativeHandle(
      ref,
      () => ({
        slideLeft: () => triggerSlide('left', onSwipeLeft),
        slideRight: () => triggerSlide('right', onSwipeRight),
      }),
      [triggerSlide, onSwipeLeft, onSwipeRight]
    );

    // Click handler for side peek cards
    const handleSelectPrev = () => {
      if (!prevDoc || isTransitioning) return;
      triggerSlide('right', () => {
        onSelectDocument(prevDoc.id);
        onPreviewPage(1);
      });
    };

    const handleSelectNext = () => {
      if (!nextDoc || isTransitioning) return;
      triggerSlide('left', () => {
        onSelectDocument(nextDoc.id);
        onPreviewPage(1);
      });
    };

    // 1. Pointer Down (Touch / Mouse)
    const handlePointerDown = (e: React.PointerEvent) => {
      if (isTransitioning) return;
      // Only handle primary button for mouse
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      startTimeRef.current = Date.now();
      axisLockedRef.current = null;
      setIsDragging(true);
    };

    // 2. Pointer Move
    const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging || startXRef.current === null || startYRef.current === null) return;

      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;

      // Detect axis lock to preserve natural vertical page scrolling on mobile
      if (!axisLockedRef.current) {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
          axisLockedRef.current = 'y';
          setIsDragging(false);
          setDragX(0);
          return;
        }
        if (Math.abs(deltaX) > 8) {
          axisLockedRef.current = 'x';
        }
      }

      if (axisLockedRef.current === 'x') {
        // Apply slight resistance when dragging beyond single-document boundaries
        let offset = deltaX;
        if (!hasMultipleDocs && activeDoc.pageCount <= 1) {
          offset = deltaX * 0.3; // Rubber-band effect
        }
        setDragX(offset);
      }
    };

    // 3. Pointer Up / End
    const handlePointerEnd = (e: React.PointerEvent) => {
      if (!isDragging || startXRef.current === null) {
        setIsDragging(false);
        setDragX(0);
        return;
      }

      const endX = e.clientX;
      const deltaX = endX - startXRef.current;
      const duration = Date.now() - startTimeRef.current;
      const velocity = deltaX / Math.max(duration, 1);

      startXRef.current = null;
      startYRef.current = null;
      setIsDragging(false);

      // Check if swipe condition met (distance threshold or flick velocity)
      const isSwipeLeft = deltaX < -40 || (velocity < -0.35 && deltaX < -15);
      const isSwipeRight = deltaX > 40 || (velocity > 0.35 && deltaX > 15);

      if (isSwipeLeft) {
        triggerSlide('left', onSwipeLeft);
      } else if (isSwipeRight) {
        triggerSlide('right', onSwipeRight);
      } else {
        // Smoothly spring back to center
        setDragX(0);
      }
    };

    // 4. Trackpad / Wheel Horizontal Scroll
    const handleWheel = (e: React.WheelEvent) => {
      if (Math.abs(e.deltaX) > 30 && !wheelLockRef.current && !isTransitioning) {
        wheelLockRef.current = true;
        if (e.deltaX > 0) {
          triggerSlide('left', onSwipeLeft);
        } else {
          triggerSlide('right', onSwipeRight);
        }
        setTimeout(() => {
          wheelLockRef.current = false;
        }, 400);
      }
    };

    return (
      <div
        className="relative w-full max-w-[360px] sm:max-w-[400px] overflow-hidden mx-auto py-1 select-none touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        role="region"
        aria-label="Document preview carousel"
      >
        {/* Animated Carousel Track */}
        <div
          className="flex items-center justify-center will-change-transform cursor-grab active:cursor-grabbing"
          style={{
            transform: `translateX(${dragX}px)`,
            transition:
              isDragging || isTransitioning
                ? isDragging
                  ? 'none'
                  : 'transform 220ms cubic-bezier(0.2, 0, 0, 1)'
                : 'transform 260ms cubic-bezier(0.2, 0, 0, 1)',
          }}
        >
          {/* Left Side Peek Card (Shown only when multiple documents exist) */}
          {prevDoc && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPrev();
              }}
              className="shrink-0 w-[240px] sm:w-[260px] mr-3 sm:mr-4 scale-[0.88] opacity-65 hover:opacity-90 active:scale-[0.85] transition-all duration-200 cursor-pointer pointer-events-auto"
              aria-label={`Switch to previous document: ${prevDoc.name}`}
              title={`Switch to: ${prevDoc.name}`}
            >
              <DocumentPreview
                document={prevDoc}
                previewPage={1}
                className="w-full pointer-events-none"
              />
            </div>
          )}

          {/* Center Active Document Card */}
          <div className="shrink-0 w-[240px] sm:w-[260px] z-20">
            <DocumentPreview
              document={activeDoc}
              previewPage={previewPage}
              onRemove={onRemove}
              onPageCountDetected={(count) => onPageCountDetected?.(activeDoc.id, count)}
              className="w-full"
            />
          </div>

          {/* Right Side Peek Card (Shown only when multiple documents exist) */}
          {nextDoc && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleSelectNext();
              }}
              className="shrink-0 w-[240px] sm:w-[260px] ml-3 sm:ml-4 scale-[0.88] opacity-65 hover:opacity-90 active:scale-[0.85] transition-all duration-200 cursor-pointer pointer-events-auto"
              aria-label={`Switch to next document: ${nextDoc.name}`}
              title={`Switch to: ${nextDoc.name}`}
            >
              <DocumentPreview
                document={nextDoc}
                previewPage={1}
                className="w-full pointer-events-none"
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);
