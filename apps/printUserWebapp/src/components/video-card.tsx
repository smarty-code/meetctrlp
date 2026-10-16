"use client"

import React, { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Play } from "lucide-react"
import { BIG_PLAY_BUTTON_CLASS, PROMO_VIDEO_URL, getVideoPoster, getVideoSrc } from "../lib/promo-video"

interface VideoCardProps {
  /** A direct video file URL (MP4/WebM). Cloudinary URLs get a lighter rendition and a poster automatically. */
  videoUrl?: string
  /** Caption displayed below the frame. */
  caption?: string
  /** Additional custom container styling. */
  className?: string
}

/** Start loading this far before the card scrolls into view. */
const NEAR_VIEWPORT_MARGIN = "300px"

/** Shown before the player chunk loads; the play button sits exactly where the player's does. */
const PlayerPlaceholder: React.FC<{ onPlay?: () => void; label: string }> = ({ onPlay, label }) => (
  <button
    type="button"
    onClick={onPlay}
    aria-label={`Play video: ${label}`}
    className="flex h-full w-full cursor-pointer items-center justify-center bg-midnight"
  >
    <span className={BIG_PLAY_BUTTON_CLASS}>
      <Play className="size-5 fill-paper" />
    </span>
  </button>
)

// The player's JS (and the video's metadata/poster requests) stays out of the initial load entirely.
const VideoPlayer = dynamic(() => import("./video-player").then((m) => m.VideoPlayer), {
  ssr: false,
  loading: () => <PlayerPlaceholder label="loading" />,
})

/** Resolves once the window `load` event has fired and the main thread is idle. */
function useAfterPageLoad(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let idleId: number | undefined
    let timeoutId: number | undefined

    const scheduleIdle = () => {
      // Safari has no requestIdleCallback.
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(() => setReady(true), { timeout: 2000 })
      } else {
        timeoutId = window.setTimeout(() => setReady(true), 200)
      }
    }

    if (document.readyState === "complete") scheduleIdle()
    else window.addEventListener("load", scheduleIdle, { once: true })

    return () => {
      window.removeEventListener("load", scheduleIdle)
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId)
      window.clearTimeout(timeoutId)
    }
  }, [])

  return ready
}

/** Flips to true (once) when the element comes within `rootMargin` of the viewport. */
function useNearViewport<T extends Element>(ref: React.RefObject<T | null>, rootMargin: string): boolean {
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin, near])

  return near
}

export const VideoCard: React.FC<VideoCardProps> = ({
  videoUrl = PROMO_VIDEO_URL,
  caption,
  className = "",
}) => {
  const frameRef = useRef<HTMLDivElement>(null)
  const pageLoaded = useAfterPageLoad()
  const nearViewport = useNearViewport(frameRef, NEAR_VIEWPORT_MARGIN)
  // A tap before the deferred load kicks in should still play straight away.
  const [playRequested, setPlayRequested] = useState(false)

  if (!videoUrl) return null

  const title = caption || "Shop video demonstration"
  const shouldMountPlayer = playRequested || (pageLoaded && nearViewport)

  return (
    <div className={`mx-auto mt-4 w-full max-w-xl px-4 sm:mt-6 sm:px-6 md:mt-8 md:max-w-2xl lg:max-w-3xl ${className}`}>
      <div className="w-full rounded-xl border border-graphite/20 bg-paper p-3 sm:p-4">
        {/* Fixed 16:9 frame so swapping placeholder → player never shifts layout. */}
        <div ref={frameRef} className="relative aspect-video w-full overflow-hidden rounded-xl border border-graphite/10 bg-midnight">
          {shouldMountPlayer ? (
            <VideoPlayer
              src={getVideoSrc(videoUrl)}
              poster={getVideoPoster(videoUrl)}
              title={title}
              autoStart={playRequested}
            />
          ) : (
            <PlayerPlaceholder label={title} onPlay={() => setPlayRequested(true)} />
          )}
        </div>

        {caption && (
          <div className="mt-2.5 flex items-center justify-center text-center">
            <p className="text-[12px] font-medium text-ash select-none sm:text-caption">{caption}</p>
          </div>
        )}
      </div>
    </div>
  )
}
