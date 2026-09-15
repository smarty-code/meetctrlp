"use client"

import React, { useState } from "react"
import { FileText, Image as ImageIcon } from "lucide-react"
import { ConfigurableDocument } from "../../types/upload"
import { PdfCanvasPreview } from "../customize/pdf-canvas-preview"

interface DocumentThumbnailProps {
  document: ConfigurableDocument
  className?: string
}

export function DocumentThumbnail({
  document,
  className = "size-11 sm:size-12",
}: DocumentThumbnailProps) {
  const [imageError, setImageError] = useState(false)
  const isImage = document.type.startsWith("image/")
  const isPdf =
    document.type === "application/pdf" ||
    document.name.toLowerCase().endsWith(".pdf")

  const previewUrl = document.previewUrl

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-graphite/20 bg-eel-light/40 ${className}`}
    >
      {isImage && previewUrl && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`Preview of ${document.name}`}
          className="size-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : isPdf && (document.file || previewUrl) ? (
        <div className="pointer-events-none relative size-full overflow-hidden flex items-center justify-center">
          <PdfCanvasPreview
            file={document.file}
            previewUrl={previewUrl}
            pageNumber={1}
          />
        </div>
      ) : isImage ? (
        <ImageIcon className="size-5 text-ash" />
      ) : (
        <div className="flex flex-col items-center justify-center">
          <FileText className="size-5 text-ash" />
          <span className="text-[7px] font-bold uppercase text-ash leading-none mt-0.5">
            PDF
          </span>
        </div>
      )}
    </div>
  )
}
