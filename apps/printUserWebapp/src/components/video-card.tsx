"use client"

import React, { useState } from "react"
import { Play } from "lucide-react"

interface VideoCardProps {
  /** The video URL (YouTube, Vimeo, or direct MP4/MOV). Dynamic from shop or page context. */
  videoUrl?: string
  /** Optional caption or video title displayed below the frame (matches reference screenshot). */
  caption?: string
  /** Additional custom container styling. */
  className?: string
  /** Whether the video should autoplay muted in a loop (default: true). */
  autoPlay?: boolean
}

/**
 * Extracts a YouTube embed URL from various YouTube link formats:
 * - youtu.be/<id>
 * - youtube.com/watch?v=<id>
 * - youtube.com/embed/<id>
 * - youtube.com/shorts/<id>
 */
export function getEmbedUrl(url?: string): { isYouTube: boolean; embedUrl: string } {
  if (!url) {
    return { isYouTube: false, embedUrl: "" }
  }

  // Handle youtu.be/<id>
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
  if (shortMatch?.[1]) {
    const id = shortMatch[1]
    return {
      isYouTube: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&controls=1&rel=0&modestbranding=1`,
    }
  }

  // Handle youtube.com/watch?v=<id> or shorts/<id> or embed/<id>
  const longMatch = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))([a-zA-Z0-9_-]+)/)
  if (longMatch?.[1]) {
    const id = longMatch[1]
    return {
      isYouTube: true,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&controls=1&rel=0&modestbranding=1`,
    }
  }

  // Fallback for direct video URLs (e.g., .mp4, .mov, .webm)
  return { isYouTube: false, embedUrl: url }
}

export const VideoCard: React.FC<VideoCardProps> = ({
  videoUrl,
  caption,
  className = "",
  autoPlay = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const { isYouTube, embedUrl } = getEmbedUrl(videoUrl)

  if (!videoUrl || !embedUrl) {
    return null
  }

  return (
    <div className={`mx-auto mt-4 w-full max-w-xl px-4 sm:mt-6 sm:px-6 md:mt-8 md:max-w-2xl lg:max-w-3xl ${className}`}>
      {/* Outer Card Frame following CtrlP Design System: Paper surface, 2px border, 16px/24px padding */}
      <div className="w-full rounded-2xl border border-graphite/20 bg-paper p-3 sm:p-4">
        {/* Responsive 16:9 Video Canvas Frame */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-graphite/10 bg-midnight">
          {isYouTube ? (
            <iframe
              src={embedUrl}
              title={caption || "Shop video demonstration"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              className="h-full w-full border-0"
            />
          ) : (
            <video
              src={embedUrl}
              autoPlay={autoPlay}
              loop
              muted
              playsInline
              controls
              className="h-full w-full object-cover"
            />
          )}

          {/* Optional overlay play indicator when video is paused */}
          {!isPlaying && (
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 flex items-center justify-center bg-midnight/30 transition-colors hover:bg-midnight/20"
              aria-label="Play video"
            >
              <div className="flex items-center gap-2 rounded-full border border-paper/40 bg-midnight/60 px-4 py-2 text-caption font-bold text-paper backdrop-blur-sm transition-transform hover:scale-105 active:scale-95">
                <Play className="size-4 fill-paper text-paper" />
                <span>play video</span>
              </div>
            </button>
          )}
        </div>

        {/* Dynamic Caption below the frame (matches reference screenshot style) */}
        {caption && (
          <div className="mt-2.5 flex items-center justify-center text-center">
            <p className="text-[12px] font-medium text-ash select-none sm:text-caption">
              {caption}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
