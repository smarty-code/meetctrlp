"use client"

import React, { useEffect, useState, useCallback } from "react"
import { FileText } from "lucide-react"

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

              {/* Document stack icon */}
              <div className="mt-8 mb-8 flex items-center justify-center">
                <div className="relative">
                  {/* Stacked document pages */}
                  <div className="flex size-20 items-center justify-center rounded-xl border-2 border-graphite/15 bg-paper sm:size-24">
                    <div className="flex flex-col items-start gap-1.5 px-3">
                      <div className="h-1.5 w-10 rounded-full bg-ecto-green/60 sm:w-12" />
                      <div className="h-1.5 w-8 rounded-full bg-macaw-blue/50 sm:w-10" />
                      <div className="h-1.5 w-11 rounded-full bg-graphite/20 sm:w-14" />
                      <div className="h-1.5 w-7 rounded-full bg-graphite/15 sm:w-9" />
                    </div>
                  </div>
                  {/* Subtle back page peek */}
                  <div
                    className="absolute -top-1.5 left-1 -z-10 size-20 rounded-xl border-2 border-graphite/10 bg-eel-light/30 sm:size-24"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-[280px]">
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-graphite/10">
                  <div
                    className="h-full rounded-full bg-ecto-green transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label="Upload progress"
                  />
                  {/* Animated shimmer on the progress bar */}
                  {progress < 100 && (
                    <div className="animate-progressShimmer absolute inset-0 rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)]" />
                  )}
                </div>
              </div>

              {/* Rotating info message */}
              <p
                className="mt-6 min-h-[1.5em] text-center text-caption font-medium text-ash transition-opacity duration-300"
                aria-live="polite"
              >
                {isChecking ? "Checking documents…" : ROTATING_MESSAGES[messageIndex]}
              </p>

              {/* Cancel link */}
              <div className="mt-5 border-t border-graphite/10 pt-4 w-full flex justify-center">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-body font-bold text-ecto-green transition-colors hover:text-ecto-green/80 active:translate-y-px"
                >
                  Cancel Upload
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
