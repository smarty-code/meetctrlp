"use client"

import React, { useEffect, useRef, useState } from "react"
import { Button } from "@ctrlp/ui/button"
import { Loader2, X } from "lucide-react"
import { decodeQrFromFile, decodeQrFromVideo } from "../lib/decode-qr"
import { shopSlugFromQrPayload } from "../lib/shop-qr"

interface ScanShopQrOverlayProps {
  open: boolean
  onClose: () => void
  onShopFound: (slug: string) => void
}

export const ScanShopQrOverlay: React.FC<ScanShopQrOverlayProps> = ({
  open,
  onClose,
  onShopFound,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const onShopFoundRef = useRef(onShopFound)
  const [status, setStatus] = useState("Starting camera…")
  const [error, setError] = useState<string | null>(null)

  onShopFoundRef.current = onShopFound

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let raf = 0
    let lastScanAt = 0
    let found = false

    const stop = () => {
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      const video = videoRef.current
      if (video) {
        video.srcObject = null
      }
    }

    const reportSlug = (payload: string) => {
      const slug = shopSlugFromQrPayload(payload)
      if (!slug) {
        setError("This QR is not a CtrlP shop. Scan the code on the shop counter.")
        setStatus("Point the camera at the shop QR")
        return false
      }
      found = true
      stop()
      onShopFoundRef.current(slug)
      return true
    }

    const tick = async (now: number) => {
      if (cancelled || found) {
        return
      }
      raf = requestAnimationFrame(tick)
      const video = videoRef.current
      if (!video || video.readyState < 2 || now - lastScanAt < 220) {
        return
      }
      lastScanAt = now
      try {
        const payload = await decodeQrFromVideo(video)
        if (payload && !cancelled && !found) {
          reportSlug(payload)
        }
      } catch {
        // Keep scanning until the user cancels.
      }
    }

    const start = async () => {
      setError(null)
      setStatus("Starting camera…")
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open the camera. Use a photo of the shop QR instead.")
        setStatus("Use a photo of the QR")
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const video = videoRef.current
        if (!video) {
          return
        }
        video.srcObject = stream
        await video.play()
        setStatus("Point the camera at the shop QR")
        raf = requestAnimationFrame(tick)
      } catch {
        setError("Camera permission is needed to scan. You can still use a photo of the QR.")
        setStatus("Use a photo of the QR")
      }
    }

    void start()

    return () => {
      cancelled = true
      stop()
    }
  }, [open])

  const handlePhotoSelected = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) {
      return
    }
    setError(null)
    setStatus("Reading QR…")
    try {
      const payload = await decodeQrFromFile(file)
      if (!payload) {
        setError("Could not read a QR from that photo. Try again in better light.")
        setStatus("Point the camera at the shop QR")
        return
      }
      const slug = shopSlugFromQrPayload(payload)
      if (!slug) {
        setError("This QR is not a CtrlP shop. Scan the code on the shop counter.")
        setStatus("Point the camera at the shop QR")
        return
      }
      onShopFoundRef.current(slug)
    } catch {
      setError("Could not read that photo. Try scanning again.")
      setStatus("Point the camera at the shop QR")
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-midnight text-paper">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-caption font-bold tracking-caption uppercase">Scan shop QR</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="flex size-10 items-center justify-center rounded-xl border border-paper/30 bg-paper/15 text-paper"
        >
          <X className="size-5 stroke-[2.2]" />
        </button>
      </div>

      <div className="relative mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-4 pb-6">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-paper/20 bg-midnight">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[220px] w-[220px] rounded-xl border-2 border-lingot-lime" />
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-center text-body font-bold">
          {status === "Starting camera…" || status === "Reading QR…" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          <span>{status}</span>
        </p>
        {error ? (
          <p className="mt-2 rounded-xl border border-paper/20 bg-paper/10 px-3 py-2 text-center text-caption font-medium text-paper">
            {error}
          </p>
        ) : null}

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            void handlePhotoSelected(event.target.files)
            event.target.value = ""
          }}
        />

        <div className="mt-4 flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl border-2 border-lingot-lime bg-paper text-[15px] font-bold text-midnight"
            onClick={() => photoInputRef.current?.click()}
          >
            Use a photo of the QR
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-12 w-full rounded-xl text-[15px] font-bold text-paper"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
