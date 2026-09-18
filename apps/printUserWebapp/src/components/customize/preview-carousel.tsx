"use client"

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"
import { ConfigurableDocument } from "../../types/upload"
import { DocumentPreview } from "./document-preview"

type EmblaCarouselApi = NonNullable<UseEmblaCarouselType[1]>

export interface PreviewCarouselHandle {
  slideLeft: () => void
  slideRight: () => void
}

interface PreviewCarouselProps {
  documents: ConfigurableDocument[]
  selectedId: string
  previewPage: number
  onSelectDocument: (id: string) => void
  onRemove?: () => void
  onPageCountDetected?: (docId: string, count: number) => void
}

const SELECTED_SCALE = 1
const PEEK_SCALE = 0.88
const SELECTED_OPACITY = 1
const PEEK_OPACITY = 0.65

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export const PreviewCarousel = forwardRef<
  PreviewCarouselHandle,
  PreviewCarouselProps
>(function PreviewCarousel(
  {
    documents,
    selectedId,
    previewPage,
    onSelectDocument,
    onRemove,
    onPageCountDetected,
  },
  ref
) {
  const selectedIndex = Math.max(
    0,
    documents.findIndex((item) => item.id === selectedId)
  )
  const startIndexRef = useRef(selectedIndex)
  const documentsRef = useRef(documents)
  const selectedIdRef = useRef(selectedId)
  const onSelectDocumentRef = useRef(onSelectDocument)
  const tweenNodesRef = useRef<Array<HTMLDivElement | null>>([])
  const dragMovedRef = useRef(false)
  const pointerDownRef = useRef(false)

  documentsRef.current = documents
  selectedIdRef.current = selectedId
  onSelectDocumentRef.current = onSelectDocument

  const emblaOptions = useMemo(
    () => ({
      align: "center" as const,
      loop: false,
      containScroll: false as const,
      duration: 22,
      skipSnaps: false,
      startIndex: startIndexRef.current,
    }),
    []
  )

  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions)

  const tweenSlides = useCallback((api: EmblaCarouselApi) => {
    const snaps = api.scrollSnapList()
    const progress = api.scrollProgress()
    const spacing = snaps.length > 1 ? Math.abs(snaps[1] - snaps[0]) : 1

    snaps.forEach((snap, index) => {
      const node = tweenNodesRef.current[index]
      if (!node) return

      const distance = Math.abs(snap - progress)
      const t = spacing === 0 ? 0 : clamp(distance / spacing, 0, 1)
      const scale = SELECTED_SCALE - t * (SELECTED_SCALE - PEEK_SCALE)
      const opacity = SELECTED_OPACITY - t * (SELECTED_OPACITY - PEEK_OPACITY)

      node.style.transform = `scale(${scale})`
      node.style.opacity = String(opacity)
    })
  }, [])

  const handleSelect = useCallback((api: EmblaCarouselApi) => {
    const index = api.selectedScrollSnap()
    const id = documentsRef.current[index]?.id
    if (id && id !== selectedIdRef.current) {
      onSelectDocumentRef.current(id)
    }
  }, [])

  useLayoutEffect(() => {
    if (!emblaApi) return

    tweenSlides(emblaApi)
    const onPointerDown = () => {
      pointerDownRef.current = true
      dragMovedRef.current = false
    }
    const onPointerUp = () => {
      pointerDownRef.current = false
    }
    const onScroll = (api: EmblaCarouselApi) => {
      if (pointerDownRef.current) {
        dragMovedRef.current = true
      }
      tweenSlides(api)
    }

    emblaApi.on("pointerDown", onPointerDown)
    emblaApi.on("pointerUp", onPointerUp)
    emblaApi.on("scroll", onScroll)
    emblaApi.on("slideFocus", tweenSlides)
    emblaApi.on("reInit", tweenSlides)
    emblaApi.on("select", handleSelect)

    return () => {
      emblaApi.off("pointerDown", onPointerDown)
      emblaApi.off("pointerUp", onPointerUp)
      emblaApi.off("scroll", onScroll)
      emblaApi.off("slideFocus", tweenSlides)
      emblaApi.off("reInit", tweenSlides)
      emblaApi.off("select", handleSelect)
    }
  }, [emblaApi, tweenSlides, handleSelect])

  useEffect(() => {
    if (!emblaApi) return
    const slideCount = emblaApi.slideNodes().length
    if (selectedIndex < 0 || selectedIndex >= slideCount) return
    if (emblaApi.selectedScrollSnap() === selectedIndex) return
    emblaApi.scrollTo(selectedIndex)
  }, [emblaApi, selectedIndex])

  useImperativeHandle(
    ref,
    () => ({
      slideLeft: () => {
        emblaApi?.scrollNext()
      },
      slideRight: () => {
        emblaApi?.scrollPrev()
      },
    }),
    [emblaApi]
  )

  if (documents.length === 0) {
    return null
  }

  return (
    <div
      className="relative mx-auto w-full max-w-[360px] py-1 select-none sm:max-w-[400px]"
      role="region"
      aria-label="Document preview carousel"
    >
      <div
        ref={emblaRef}
        className="cursor-grab overflow-hidden active:cursor-grabbing"
      >
        <div className="flex touch-pan-y">
          {documents.map((doc, index) => {
            const isSelected = doc.id === selectedId

            return (
              <div
                key={doc.id}
                className="min-w-0 shrink-0 grow-0 basis-[68%] px-2 sm:px-2.5"
                onClick={() => {
                  if (isSelected || dragMovedRef.current || !emblaApi) return
                  emblaApi.scrollTo(index)
                }}
              >
                <div
                  ref={(node) => {
                    tweenNodesRef.current[index] = node
                  }}
                  className="origin-center will-change-transform"
                >
                  <DocumentPreview
                    document={doc}
                    previewPage={isSelected ? previewPage : 1}
                    onRemove={isSelected ? onRemove : undefined}
                    onPageCountDetected={
                      isSelected
                        ? (count) => onPageCountDetected?.(doc.id, count)
                        : undefined
                    }
                    className={`w-full ${isSelected ? "" : "pointer-events-none"}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
