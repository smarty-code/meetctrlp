"use client"

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { ConfigurableDocument } from "../../types/upload"
import { DocumentPreview } from "./document-preview"

export interface PreviewCarouselHandle {
  slideLeft: () => void
  slideRight: () => void
}

interface PreviewCarouselProps {
  documents: ConfigurableDocument[]
  selectedId: string
  previewPage: number
  onSelectDocument: (id: string) => void
  onPreviewPage: (page: number) => void
  onSwipeLeft: () => void
  onSwipeRight: () => void
  onRemove?: () => void
  onPageCountDetected?: (docId: string, count: number) => void
}

type Direction = "left" | "right"
type TransitionKind = "document" | "page" | null

const TRANSITION_MS = 380

export const PreviewCarousel = forwardRef<
  PreviewCarouselHandle,
  PreviewCarouselProps
>(function PreviewCarousel(
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
  const activeDoc =
    documents.find((item) => item.id === selectedId) ?? documents[0]
  const currentIndex = documents.findIndex((item) => item.id === activeDoc.id)
  const prevDoc = currentIndex > 0 ? documents[currentIndex - 1] : null
  const nextDoc =
    currentIndex < documents.length - 1 ? documents[currentIndex + 1] : null

  const trackRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef<number | null>(null)
  const startYRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const axisRef = useRef<"x" | "y" | null>(null)
  const transitionRef = useRef<TransitionKind>(null)
  const directionRef = useRef<Direction | null>(null)
  const callbackRef = useRef<(() => void) | null>(null)
  const isAnimatingRef = useRef(false)
  const didDragRef = useRef(false)

  const [dragX, setDragX] = useState(0)
  const [cardStep, setCardStep] = useState(276)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isPageExiting, setIsPageExiting] = useState(false)
  const [pageDirection, setPageDirection] = useState<Direction>("left")

  const getCardStep = useCallback(() => {
    const cards = trackRef.current?.querySelectorAll<HTMLElement>(
      "[data-carousel-card]"
    )
    if (cards && cards.length > 1) {
      const step = Math.abs(
        cards[1].getBoundingClientRect().left -
          cards[0].getBoundingClientRect().left
      )
      if (step > 0) return step
    }
    return 276
  }, [])

  const finish = useCallback(() => {
    setIsResetting(true)
    setDragX(0)
    requestAnimationFrame(() => {
      setIsResetting(false)
      setIsAnimating(false)
      isAnimatingRef.current = false
    })
  }, [])

  const startDocumentTransition = useCallback(
    (direction: Direction, callback: () => void) => {
      if (isAnimatingRef.current) return
      isAnimatingRef.current = true
      transitionRef.current = "document"
      directionRef.current = direction
      callbackRef.current = callback
      setIsDragging(false)
      setIsAnimating(true)
      const step = getCardStep()
      setCardStep(step)
      setDragX(direction === "left" ? -step : step)
    },
    [getCardStep]
  )

  const startPageTransition = useCallback(
    (direction: Direction, callback: () => void) => {
      if (isAnimatingRef.current) return
      isAnimatingRef.current = true
      transitionRef.current = "page"
      directionRef.current = direction
      callbackRef.current = callback
      setIsDragging(false)
      setIsAnimating(true)
      setPageDirection(direction)
      setIsPageExiting(true)
    },
    []
  )

  const slide = useCallback(
    (direction: Direction) => {
      const isPageTurn =
        direction === "left"
          ? previewPage < activeDoc.pageCount
          : previewPage > 1

      if (isPageTurn) {
        startPageTransition(
          direction,
          direction === "left" ? onSwipeLeft : onSwipeRight
        )
        return
      }

      const adjacentDoc = direction === "left" ? nextDoc : prevDoc
      if (!adjacentDoc) {
        setDragX(0)
        return
      }

      startDocumentTransition(
        direction,
        direction === "left" ? onSwipeLeft : onSwipeRight
      )
    },
    [
      activeDoc.pageCount,
      nextDoc,
      onSwipeLeft,
      onSwipeRight,
      previewPage,
      prevDoc,
      startDocumentTransition,
      startPageTransition,
    ]
  )

  const slideLeft = useCallback(() => slide("left"), [slide])
  const slideRight = useCallback(() => slide("right"), [slide])

  useImperativeHandle(ref, () => ({ slideLeft, slideRight }), [
    slideLeft,
    slideRight,
  ])

  const clearGesture = () => {
    startXRef.current = null
    startYRef.current = null
    axisRef.current = null
    setIsDragging(false)
  }

  const handlePointerDown = (event: React.PointerEvent) => {
    if (isAnimatingRef.current) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    startXRef.current = event.clientX
    startYRef.current = event.clientY
    startTimeRef.current = performance.now()
    axisRef.current = null
    didDragRef.current = false
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    if (startXRef.current === null || startYRef.current === null) return
    const deltaX = event.clientX - startXRef.current
    const deltaY = event.clientY - startYRef.current

    if (!axisRef.current) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
        clearGesture()
        setDragX(0)
        return
      }
      if (Math.abs(deltaX) > 8) {
        axisRef.current = "x"
        didDragRef.current = true
        setIsDragging(true)
      }
    }

    if (axisRef.current !== "x") return
    const atBoundary =
      (deltaX > 0 && previewPage === 1 && !prevDoc) ||
      (deltaX < 0 && previewPage === activeDoc.pageCount && !nextDoc)
    setDragX(deltaX * (atBoundary ? 0.22 : 0.78))
  }

  const handlePointerEnd = (event: React.PointerEvent) => {
    if (startXRef.current === null) {
      clearGesture()
      return
    }

    const deltaX = event.clientX - startXRef.current
    const velocity =
      deltaX / Math.max(performance.now() - startTimeRef.current, 1)
    const wasHorizontalDrag = axisRef.current === "x"
    clearGesture()
    if (!wasHorizontalDrag) return

    if (deltaX < -56 || (velocity < -0.45 && deltaX < -18)) {
      slideLeft()
    } else if (deltaX > 56 || (velocity > 0.45 && deltaX > 18)) {
      slideRight()
    } else {
      setDragX(0)
    }
  }

  const handleWheel = (event: React.WheelEvent) => {
    if (isAnimatingRef.current) return
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
    if (Math.abs(event.deltaX) < 18) return
    event.preventDefault()
    if (event.deltaX > 0) slideLeft()
    else slideRight()
  }

  const handleTrackTransitionEnd = (
    event: React.TransitionEvent<HTMLDivElement>
  ) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== "transform"
    ) {
      return
    }
    if (transitionRef.current !== "document") return
    const callback = callbackRef.current
    transitionRef.current = null
    directionRef.current = null
    callbackRef.current = null
    callback?.()
    finish()
  }

  const handlePageTransitionEnd = (
    event: React.TransitionEvent<HTMLDivElement>
  ) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== "opacity"
    ) {
      return
    }
    if (transitionRef.current !== "page" || !isPageExiting) return
    const callback = callbackRef.current
    transitionRef.current = null
    directionRef.current = null
    callbackRef.current = null
    callback?.()
    setIsPageExiting(false)
    requestAnimationFrame(() => {
      setIsAnimating(false)
      isAnimatingRef.current = false
    })
  }

  const handleSelectAdjacent = (
    direction: Direction,
    document: ConfigurableDocument
  ) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    startDocumentTransition(direction, () => {
      onSelectDocument(document.id)
      onPreviewPage(1)
    })
  }

  const progress = Math.min(Math.abs(dragX) / cardStep, 1)
  const nextScale = dragX < 0 ? 0.9 + progress * 0.1 : 0.9
  const prevScale = dragX > 0 ? 0.9 + progress * 0.1 : 0.9
  const activeScale = 1 - progress * 0.1
  const nextOpacity = dragX < 0 ? 0.7 + progress * 0.3 : 0.7
  const prevOpacity = dragX > 0 ? 0.7 + progress * 0.3 : 0.7
  const activeOpacity = 1 - progress * 0.3
  const cardTransition = isDragging
    ? "none"
    : `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${TRANSITION_MS}ms ease`
  const pageShift = pageDirection === "left" ? -20 : 20

  return (
    <div
      className="relative mx-auto w-full max-w-[360px] touch-pan-y overflow-hidden py-1 select-none sm:max-w-[400px]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={handleWheel}
      role="region"
      aria-label="Document preview carousel"
      aria-busy={isAnimating}
    >
      <div
        ref={trackRef}
        className="flex cursor-grab items-center justify-center will-change-transform active:cursor-grabbing"
        onTransitionEnd={handleTrackTransitionEnd}
        style={{
          transform: `translate3d(${dragX}px, 0, 0)`,
          transition:
            isDragging || isResetting
              ? "none"
              : `transform ${TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          backfaceVisibility: "hidden",
        }}
      >
        {prevDoc ? (
          <AdjacentPreview
            direction="right"
            document={prevDoc}
            opacity={prevOpacity}
            scale={prevScale}
            transition={cardTransition}
            onSelect={() => handleSelectAdjacent("right", prevDoc)}
          />
        ) : nextDoc ? (
          <CardSpacer />
        ) : null}

        <div
          data-carousel-card
          className="z-20 w-[240px] shrink-0 will-change-transform sm:w-[260px]"
          onTransitionEnd={handlePageTransitionEnd}
          style={{
            transform: `translate3d(${isPageExiting ? pageShift : 0}px, 0, 0) scale(${activeScale})`,
            opacity: isPageExiting ? 0 : activeOpacity,
            transition: isPageExiting
              ? `transform ${TRANSITION_MS / 2}ms ease, opacity ${TRANSITION_MS / 2}ms ease`
              : cardTransition,
          }}
        >
          <DocumentPreview
            document={activeDoc}
            previewPage={previewPage}
            onRemove={onRemove}
            onPageCountDetected={(count) =>
              onPageCountDetected?.(activeDoc.id, count)
            }
            className="w-full"
          />
        </div>

        {nextDoc ? (
          <AdjacentPreview
            direction="left"
            document={nextDoc}
            opacity={nextOpacity}
            scale={nextScale}
            transition={cardTransition}
            onSelect={() => handleSelectAdjacent("left", nextDoc)}
          />
        ) : prevDoc ? (
          <CardSpacer side="right" />
        ) : null}
      </div>
    </div>
  )
})

function AdjacentPreview({
  direction,
  document,
  opacity,
  scale,
  transition,
  onSelect,
}: {
  direction: Direction
  document: ConfigurableDocument
  opacity: number
  scale: number
  transition: string
  onSelect: () => void
}) {
  return (
    <div
      data-carousel-card
      className={`z-10 w-[240px] shrink-0 cursor-pointer will-change-transform sm:w-[260px] ${
        direction === "right" ? "mr-3 sm:mr-4" : "ml-3 sm:ml-4"
      }`}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
      style={{ transform: `scale(${scale})`, opacity, transition }}
      aria-label={`Switch to ${direction === "right" ? "previous" : "next"} document: ${document.name}`}
      title={`Switch to: ${document.name}`}
    >
      <DocumentPreview
        document={document}
        previewPage={1}
        className="pointer-events-none w-full"
      />
    </div>
  )
}

function CardSpacer({ side = "left" }: { side?: "left" | "right" }) {
  return (
    <div
      data-carousel-card
      className={`pointer-events-none invisible w-[240px] shrink-0 sm:w-[260px] ${
        side === "left" ? "mr-3 sm:mr-4" : "ml-3 sm:ml-4"
      }`}
      aria-hidden="true"
    />
  )
}
