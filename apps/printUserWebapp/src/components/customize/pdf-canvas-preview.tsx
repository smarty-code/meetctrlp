"use client"

import React, { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"

interface PdfCanvasPreviewProps {
  file?: File
  previewUrl?: string
  pageNumber: number
  onPageCountDetected?: (count: number) => void
}

export function PdfCanvasPreview({
  file,
  previewUrl,
  pageNumber,
  onPageCountDetected,
}: PdfCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function renderPage() {
      if (!canvasRef.current || (!file && !previewUrl)) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        // 1. Ensure pdfjsLib is loaded in browser window
        let pdfjs = (window as any).pdfjsLib
        if (!pdfjs) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector("script[data-pdfjs]")
            if (existing) {
              if ((window as any).pdfjsLib) {
                resolve()
                return
              }
              existing.addEventListener("load", () => resolve())
              existing.addEventListener("error", () =>
                reject(new Error("PDF.js script load failed"))
              )
              return
            }
            const script = document.createElement("script")
            script.src =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
            script.setAttribute("data-pdfjs", "true")
            script.onload = () => resolve()
            script.onerror = () =>
              reject(new Error("PDF.js script load failed"))
            document.head.appendChild(script)
          })
          pdfjs = (window as any).pdfjsLib
        }

        if (!pdfjs) throw new Error("PDF library unavailable")

        pdfjs.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"

        // 2. Load PDF document source
        let source: any
        if (file) {
          const buffer = await file.arrayBuffer()
          source = { data: buffer }
        } else if (previewUrl) {
          source = { url: previewUrl }
        }

        if (isCancelled) return

        const loadingTask = pdfjs.getDocument(source)
        const pdf = await loadingTask.promise

        if (isCancelled) return

        if (onPageCountDetected && pdf.numPages > 0) {
          onPageCountDetected(pdf.numPages)
        }

        const validPage = Math.min(Math.max(1, pageNumber), pdf.numPages)
        const page = await pdf.getPage(validPage)

        if (isCancelled) return

        const canvas = canvasRef.current
        if (!canvas) return

        const context = canvas.getContext("2d")
        if (!context) return

        // Render at 2x scale for sharp retina display
        const scale = 2.0
        const viewport = page.getViewport({ scale })

        canvas.height = viewport.height
        canvas.width = viewport.width

        await page.render({
          canvasContext: context,
          viewport,
        }).promise

        if (!isCancelled) {
          setLoading(false)
        }
      } catch (err: any) {
        console.warn("PDF canvas render attempt:", err)
        if (!isCancelled) {
          setError(err.message || "Could not render PDF preview")
          setLoading(false)
        }
      }
    }

    renderPage()

    return () => {
      isCancelled = true
    }
  }, [file, previewUrl, pageNumber])

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-paper">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/85">
          <Loader2 className="size-6 animate-spin text-ecto-green" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`max-h-full max-w-full object-contain ${
          loading ? "opacity-0" : "opacity-100"
        } transition-opacity duration-200`}
      />
      {error && !loading && (
        <div className="p-4 text-center text-xs text-ash">
          <span>Displaying document fallback</span>
        </div>
      )}
    </div>
  )
}
