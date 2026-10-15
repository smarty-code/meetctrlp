"use client"

import React, { useEffect, useState, useCallback } from "react"
import { X } from "lucide-react"
import { Button } from "@ctrlp/ui/button"

interface UploadProgressDrawerProps {
  /** Whether the drawer should be visible. */
  open: boolean
  /** Number of documents being uploaded in this round. */
  documentCount: number
  /** 0–100 combined upload progress. */
  progress: number
  /** True once all files in the round have been uploaded successfully. */
  isComplete: boolean
  /** True when bytes are done but server is still validating. */
  isChecking?: boolean
  /** Called when the user taps "Cancel Upload". */
  onCancel: () => void
}

const ROTATING_MESSAGES = [
  "We don't print offensive or explicit content.",
  "Files will be auto-deleted after printing.",
  "Your documents are securely encrypted.",
  "Prints are available for counter pickup.",
]

/** Duration each rotating message stays visible (ms). */
const MESSAGE_ROTATE_INTERVAL = 3000

/**
 * A bottom-sheet overlay that appears during document upload.
 *
 * **Uploading state:** document icon, progress bar, rotating info messages, cancel link.
 * **Complete state:** success checkmark with count, auto-continues.
 *
 * Follows the CtrlP design system: flat borders, 12px radius, no shadows/gradients.
 */
export const UploadProgressDrawer: React.FC<UploadProgressDrawerProps> = ({
  open,
  documentCount,
  progress,
  isComplete,
  isChecking = false,
  onCancel,
}) => {
  const [messageIndex, setMessageIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)

  // Rotate info messages while uploading
  useEffect(() => {
    if (isComplete) return
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % ROTATING_MESSAGES.length)
    }, MESSAGE_ROTATE_INTERVAL)
    return () => clearInterval(timer)
  }, [isComplete])

  // Manage open/close animation
  useEffect(() => {
    if (open) {
      setIsVisible(true)
      // Trigger the slide-up after a frame so the CSS transition fires
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimatingIn(true))
      })
    } else {
      setIsAnimatingIn(false)
      const timer = setTimeout(() => setIsVisible(false), 350)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // Reset message index when drawer opens
  useEffect(() => {
    if (open) setMessageIndex(0)
  }, [open])

  const handleCancel = useCallback(() => {
    if (!isComplete) onCancel()
  }, [isComplete, onCancel])

  if (!isVisible) return null

  const clampedProgress = Math.min(Math.max(Math.round(progress), 0), 100)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={isComplete ? "Upload complete" : "Uploading documents"}
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-midnight/40 transition-opacity duration-300 ${
          isAnimatingIn ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        className={`relative z-10 w-full max-w-lg rounded-t-2xl border-t-2 border-x-2 border-graphite/20 bg-paper transition-transform duration-350 ease-out ${
          isAnimatingIn ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "80vh" }}
      >
        {/* Swipe handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-graphite/20" aria-hidden="true" />
        </div>

        {/* Content area */}
        <div className="flex flex-col items-center px-6 pt-4 pb-8">
          {isComplete ? (
            /* ─── SUCCESS STATE ─── */
            <>
              <h2 className="font-heading text-heading-sm font-bold text-midnight sm:text-heading">
                Uploaded successfully
              </h2>
              <p className="mt-1 text-body font-medium text-ash">
                {documentCount} of {documentCount}
              </p>

              {/* Success checkmark icon */}
              <div className="mt-8 mb-6 flex items-center justify-center">
                <div className="relative animate-successBounce">
                  {/* Green badge circle */}
                  <div className="flex size-20 items-center justify-center rounded-full border-[3px] border-ecto-green bg-eel-light sm:size-24">
                    <svg
                      className="size-10 text-ecto-green sm:size-12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  {/* Sparkle accents */}
                  <div
                    className="absolute -top-1 -right-1 size-3 rotate-12 text-ecto-green"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
                    </svg>
                  </div>
                  <div
                    className="absolute -bottom-2 -left-2 size-2.5 -rotate-6 text-macaw-blue"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ─── UPLOADING STATE ─── */
            <>
              <h2 className="font-heading text-heading-sm font-bold text-midnight sm:text-heading">
                Uploading Documents
              </h2>
              <p className="mt-1 text-body font-medium text-ash">
                {documentCount} document{documentCount === 1 ? "" : "s"}
              </p>

              {/* Animated scanning document illustration */}
              <div className="mt-8 mb-8 flex items-center justify-center">
                <div className="relative">
                  {/* Subtle back page peek (stack effect) */}
                  <div
                    className="absolute -top-1.5 left-1.5 -z-10 h-[110px] w-[86px] rounded-xl border-2 border-graphite/10 bg-eel-light/30 sm:h-[130px] sm:w-[100px]"
                    aria-hidden="true"
                  />
                  {/* Front document with scanning animation */}
                  <div className="relative h-[110px] w-[86px] overflow-hidden rounded-xl border-2 border-graphite/15 bg-paper sm:h-[130px] sm:w-[100px]">
                    <svg
                      className="h-full w-full"
                      viewBox="0 0 86 110"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      {/* Document text lines */}
                      <rect x="14" y="18" width="40" height="4" rx="2" fill="#58cc02" opacity="0.5" />
                      <rect x="14" y="28" width="52" height="4" rx="2" fill="#3c3c3c" opacity="0.15" />
                      <rect x="14" y="38" width="44" height="4" rx="2" fill="#1cb0f6" opacity="0.4" />
                      <rect x="14" y="48" width="56" height="4" rx="2" fill="#3c3c3c" opacity="0.12" />
                      <rect x="14" y="58" width="36" height="4" rx="2" fill="#3c3c3c" opacity="0.15" />
                      <rect x="14" y="68" width="48" height="4" rx="2" fill="#58cc02" opacity="0.35" />
                      <rect x="14" y="78" width="30" height="4" rx="2" fill="#3c3c3c" opacity="0.1" />
                      <rect x="14" y="88" width="42" height="4" rx="2" fill="#3c3c3c" opacity="0.12" />
                    </svg>

                    {/* Scanning laser line + glow — sweeps top to bottom */}
                    <div className="animate-scanLine pointer-events-none absolute left-0 w-full" aria-hidden="true">
                      {/* Soft green glow region above the line */}
                      <div className="h-6 w-full bg-[linear-gradient(to_bottom,transparent,rgba(88,204,2,0.10))]" />
                      {/* The bright laser line */}
                      <div className="h-[2px] w-full bg-ecto-green" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Slider with dynamic traveling percentage */}
              <div className="relative w-full max-w-[280px]">
                {/* Track */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-graphite/10">
                  <div
                    className="h-full rounded-full bg-ecto-green transition-[width] duration-300 ease-out"
                    style={{ width: `${clampedProgress}%` }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={clampedProgress}
                    aria-label={`Upload progress: ${clampedProgress}%`}
                  />
                  {/* Animated shimmer on the progress bar */}
                  {clampedProgress < 100 && (
                    <div className="animate-progressShimmer absolute inset-0 rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)]" />
                  )}
                </div>

                {/* Dynamic percentage thumb that moves along with the slider */}
                <div
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-300 ease-out"
                  style={{
                    left: `calc(19px + (${clampedProgress} / 100) * (100% - 38px))`,
                  }}
                  aria-hidden="true"
                >
                  <div className="flex h-7 min-w-[38px] items-center justify-center rounded-full border-2 border-ecto-green bg-paper px-1.5">
                    <span className="font-heading text-[12px] font-bold text-midnight tabular-nums leading-none">
                      {clampedProgress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Rotating info message */}
              <p
                className="mt-6 min-h-[1.5em] text-center text-caption font-medium text-ash transition-opacity duration-300"
                aria-live="polite"
              >
                {isChecking ? "Checking documents…" : ROTATING_MESSAGES[messageIndex]}
              </p>

              {/* Prominent cancel upload button */}
              <div className="mt-6 w-full max-w-[280px] border-t border-graphite/10 pt-5 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-12 w-full rounded-xl border-2 border-graphite/20 bg-paper text-[15px] font-bold text-midnight transition-colors hover:border-destructive/60 hover:text-destructive hover:bg-destructive/5 active:translate-y-px"
                >
                  <X className="size-4 text-inherit" />
                  <span>Cancel Upload</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
