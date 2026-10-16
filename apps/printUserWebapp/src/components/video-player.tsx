"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { LoaderCircle, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react"
import { BIG_PLAY_BUTTON_CLASS, formatVideoTime } from "../lib/promo-video"

interface VideoPlayerProps {
  src: string
  poster?: string
  title: string
  /** Start playing as soon as the player mounts (the visitor already pressed play on the placeholder). */
  autoStart?: boolean
}

/** Controls fade out after this long without pointer or keyboard activity while playing. */
const CONTROLS_HIDE_DELAY_MS = 2500
const KEYBOARD_SEEK_SECONDS = 5

/** iOS Safari only offers fullscreen on the video element itself. */
type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

const controlButtonClass =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-midnight/40 text-paper transition-colors hover:bg-midnight/60 focus-visible:ring-2 focus-visible:ring-macaw-blue focus-visible:outline-none"

/**
 * A minimal native-video player: play/pause, mute, a scrubbable timeline and fullscreen.
 *
 * Playback position is written straight to the DOM from a rAF loop (and `timeupdate`
 * while paused) so the timeline stays smooth without re-rendering React every frame.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, poster, title, autoStart = false }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<number | undefined>(undefined)
  const scrubbingRef = useRef(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)

  const renderProgress = useCallback(() => {
    const video = videoRef.current
    const track = trackRef.current
    if (!video || !track) return
    const d = video.duration
    const ratio = d > 0 && Number.isFinite(d) ? video.currentTime / d : 0
    track.style.setProperty("--progress", String(ratio))
    track.setAttribute("aria-valuemax", String(Number.isFinite(d) ? Math.floor(d) : 0))
    track.setAttribute("aria-valuenow", String(Math.floor(video.currentTime)))
    track.setAttribute("aria-valuetext", `${formatVideoTime(video.currentTime)} of ${formatVideoTime(d)}`)
  }, [])

  const renderBuffered = useCallback(() => {
    const video = videoRef.current
    const track = trackRef.current
    if (!video || !track || !(video.duration > 0)) return
    const ranges = video.buffered
    const end = ranges.length ? ranges.end(ranges.length - 1) : 0
    track.style.setProperty("--buffered", String(end / video.duration))
  }, [])

  // Smooth timeline while playing; stops itself as soon as playback pauses.
  useEffect(() => {
    if (!isPlaying) return
    let frame = 0
    const tick = () => {
      renderProgress()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, renderProgress])

  const clearHideTimer = () => window.clearTimeout(hideTimerRef.current)

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    clearHideTimer()
    if (videoRef.current && !videoRef.current.paused) {
      hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS)
    }
  }, [])

  useEffect(() => clearHideTimer, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  // Metadata can already be loaded (e.g. from cache) before React's media listeners see the event.
  useEffect(() => {
    renderProgress()
    renderBuffered()
  }, [renderProgress, renderBuffered])

  useEffect(() => {
    if (autoStart) videoRef.current?.play().catch(() => undefined)
  }, [autoStart])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused || video.ended) video.play().catch(() => undefined)
    else video.pause()
  }, [])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    // Unmuting from a zeroed volume should actually make sound.
    if (video.muted || video.volume === 0) {
      video.muted = false
      if (video.volume === 0) video.volume = 1
    } else {
      video.muted = true
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    const video = videoRef.current as WebkitVideo | null
    if (!container || !video) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined)
    } else if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => undefined)
    } else {
      video.webkitEnterFullscreen?.()
    }
  }, [])

  const seekToClientX = (clientX: number) => {
    const video = videoRef.current
    const track = trackRef.current
    if (!video || !track || !(video.duration > 0)) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    video.currentTime = ratio * video.duration
    renderProgress()
  }

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    scrubbingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    seekToClientX(e.clientX)
    revealControls()
  }

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubbingRef.current) seekToClientX(e.clientX)
  }

  const endScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const handleTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video || !(video.duration > 0)) return
    const next: Record<string, number> = {
      ArrowLeft: video.currentTime - KEYBOARD_SEEK_SECONDS,
      ArrowDown: video.currentTime - KEYBOARD_SEEK_SECONDS,
      ArrowRight: video.currentTime + KEYBOARD_SEEK_SECONDS,
      ArrowUp: video.currentTime + KEYBOARD_SEEK_SECONDS,
      Home: 0,
      End: video.duration,
    }
    const target = next[e.key]
    if (target === undefined) return
    e.preventDefault()
    video.currentTime = Math.min(video.duration, Math.max(0, target))
    renderProgress()
    revealControls()
  }

  const showControls = controlsVisible || !isPlaying

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full bg-midnight select-none ${showControls ? "" : "cursor-none"}`}
      onPointerMove={revealControls}
      onFocus={revealControls}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        aria-label={title}
        className="h-full w-full object-contain"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => {
          setIsPlaying(true)
          revealControls()
        }}
        onPause={() => {
          setIsPlaying(false)
          clearHideTimer()
          setControlsVisible(true)
        }}
        onEnded={() => setIsPlaying(false)}
        onWaiting={() => setIsWaiting(true)}
        onPlaying={() => setIsWaiting(false)}
        onCanPlay={() => setIsWaiting(false)}
        onLoadedMetadata={() => {
          renderProgress()
          renderBuffered()
        }}
        onDurationChange={renderProgress}
        onTimeUpdate={isPlaying ? undefined : renderProgress}
        onProgress={renderBuffered}
        onVolumeChange={(e) => setIsMuted(e.currentTarget.muted || e.currentTarget.volume === 0)}
      />

      {!isPlaying && !isWaiting && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer ${BIG_PLAY_BUTTON_CLASS}`}
        >
          <Play className="size-5 fill-paper" />
        </button>
      )}

      {isWaiting && (
        <LoaderCircle
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 animate-spin text-paper/80"
        />
      )}

      {/* Two small corner chips; they fade out during playback so only the picture remains. */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-between px-2 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* While paused the centre button is the play control, so this slot only offers pause. */}
        {isPlaying ? (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Pause video"
            className={`${controlButtonClass} ${showControls ? "pointer-events-auto" : ""}`}
          >
            <Pause className="size-4 fill-paper" />
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute video" : "Mute video"}
            aria-pressed={isMuted}
            className={`${controlButtonClass} ${showControls ? "pointer-events-auto" : ""}`}
          >
            {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            className={`${controlButtonClass} ${showControls ? "pointer-events-auto" : ""}`}
          >
            {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </button>
        </div>
      </div>

      {/* Hairline timeline on the bottom edge: always visible, thickens on hover/focus for scrubbing. */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        // Initial value only; renderProgress keeps valuenow/valuemax current without re-rendering.
        aria-valuenow={0}
        className="group/track absolute inset-x-0 bottom-0 flex h-3 cursor-pointer touch-none items-end focus-visible:outline-none"
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onKeyDown={handleTrackKeyDown}
      >
        <div
          className={`relative w-full bg-paper/20 transition-[height] duration-150 group-hover/track:h-1.5 group-focus-visible/track:h-1.5 ${
            showControls ? "h-1" : "h-0.5"
          }`}
        >
          <div className="absolute inset-0 origin-left bg-paper/30 [transform:scaleX(var(--buffered,0))]" />
          <div className="absolute inset-0 origin-left bg-ecto-green [transform:scaleX(var(--progress,0))]" />
        </div>
      </div>
    </div>
  )
}
