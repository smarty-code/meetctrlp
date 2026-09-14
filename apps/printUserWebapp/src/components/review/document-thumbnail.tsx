"use client"

import React, { useState } from "react"
import { FileText, Image as ImageIcon } from "lucide-react"
import { ConfigurableDocument } from "../../types/upload"
import { PdfCanvasPreview } from "../customize/pdf-canvas-preview"

interface DocumentThumbnailProps {
  document: ConfigurableDocument
}

export function DocumentThumbnail({ document }: DocumentThumbnailProps) {
  const [imageError, setImageError] = useState(false)
  const isImage = document.type.startsWith("image/")
  const isPdf =
    document.type === "application/pdf" ||
    document.name.toLowerCase().endsWith(".pdf")

  const previewUrl = document.previewUrl

  return (
    <div className="relative flex size-18 sm:size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-graphite/20 bg-eel-light/30">
      {isImage && previewUrl && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`Preview of ${document.name}`}
          className="size-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : isPdf && (document.file || previewUrl) ? (
        <div className="pointer-events-none relative size-full scale-100 overflow-hidden">
          <PdfCanvasPreview
            file={document.file}
            previewUrl={previewUrl}
            pageNumber={1}
          />
        </div>
      ) : isImage ? (
        <ImageIcon className="size-8 text-ash" />
      ) : (
        <FileText className="size-8 text-ash" />
      )}
    </div>
  )
}
