"use client"

import React, { useRef } from "react"

interface SwipeablePreviewContainerProps {
  children: React.ReactNode
  onSwipeLeft: () => void
  onSwipeRight: () => void
  className?: string
}

export function SwipeablePreviewContainer({
  children,
  onSwipeLeft,
  onSwipeRight,
  className = "",
}: SwipeablePreviewContainerProps) {
  const startXRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const wheelLockRef = useRef(false)

  // 1. Touch Gesture Handling
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.targetTouches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startXRef.current === null) return
    const endX = e.changedTouches[0].clientX
    const diff = startXRef.current - endX
    const threshold = 40 // minimum pixels for touch swipe

    if (diff > threshold) {
      onSwipeLeft()
    } else if (diff < -threshold) {
      onSwipeRight()
    }
    startXRef.current = null
  }

  // 2. Mouse / Pointer Drag Handling
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary button (left click)
    if (e.button !== 0) return
    startXRef.current = e.clientX
    isDraggingRef.current = true
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || startXRef.current === null) return
    const endX = e.clientX
    const diff = startXRef.current - endX
    const threshold = 45 // minimum pixels for pointer drag

    if (diff > threshold) {
      onSwipeLeft()
    } else if (diff < -threshold) {
      onSwipeRight()
    }
    startXRef.current = null
    isDraggingRef.current = false
  }

  // 3. Trackpad Horizontal Scroll / Wheel Gesture
  const handleWheel = (e: React.WheelEvent) => {
    // Detect significant horizontal scrolling (trackpad swipe or horizontal tilt wheel)
    if (Math.abs(e.deltaX) > 35 && !wheelLockRef.current) {
      wheelLockRef.current = true
      if (e.deltaX > 0) {
        onSwipeLeft()
      } else {
        onSwipeRight()
      }
      setTimeout(() => {
        wheelLockRef.current = false
      }, 400) // debounce wheel events
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      className={`cursor-grab touch-pan-y transition-transform select-none active:scale-[0.99] active:cursor-grabbing ${className}`}
      role="region"
      aria-label="Swipeable document preview"
    >
      {children}
    </div>
  )
}
