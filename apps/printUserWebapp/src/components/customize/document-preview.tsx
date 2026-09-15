import { X, FileImage, FileText } from "lucide-react"
import { ConfigurableDocument } from "../../types/upload"
import { customizeCopy } from "../../data/customize-repository"
import { PdfCanvasPreview } from "./pdf-canvas-preview"

interface DocumentPreviewProps {
  document: ConfigurableDocument
  previewPage?: number
  onRemove?: () => void
  onPageCountDetected?: (count: number) => void
  className?: string
}

export function DocumentPreview({
  document,
  previewPage = 1,
  onRemove,
  onPageCountDetected,
  className,
}: DocumentPreviewProps) {
  const isImage = document.type.startsWith("image/")
  const isPdf =
    document.type === "application/pdf" ||
    document.name.toLowerCase().endsWith(".pdf")
  const isLandscape = document.configuration?.orientation === "landscape"
  const previewUrl = document.previewUrl

  return (
    <div
      className={`relative ${
        isLandscape ? "aspect-4/3" : "aspect-3/4"
      } flex w-full flex-col overflow-hidden rounded-xl border-2 border-graphite bg-paper text-midnight shadow-xs transition-all duration-300 select-none ${
        className ??
        (isLandscape ? "max-w-88 sm:max-w-96" : "max-w-72 sm:max-w-80")
      }`}
    >
      {/* Remove Cross Button placed directly on the main canvas */}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove document"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute top-2.5 right-2.5 z-20 flex size-7.5 items-center justify-center rounded-full border border-graphite/30 bg-paper/90 text-graphite shadow-xs transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95"
        >
          <X className="size-4 stroke-[2.4]" />
        </button>
      )}

      {/* Real Image Rendering directly onto the main canvas */}
      {isImage && previewUrl ? (
        <div className="flex h-full w-full items-center justify-center overflow-hidden bg-paper p-3">
          <img
            src={previewUrl}
            alt={document.name}
            className="h-full w-full object-contain"
          />
        </div>
      ) : isPdf && (document.file || previewUrl) ? (
        /* Real PDF Canvas Rendering directly onto the main canvas */
        <div className="relative h-full w-full overflow-hidden bg-paper">
          <PdfCanvasPreview
            file={document.file}
            previewUrl={previewUrl}
            pageNumber={previewPage}
            onPageCountDetected={onPageCountDetected}
          />
        </div>
      ) : (
        /* Fallback Mock Sheet directly on the main canvas (no nested border) */
        <div className="flex h-full flex-col justify-between bg-paper p-4 sm:p-5">
          <div>
            <div className="flex items-center justify-between border-b-2 border-ecto-green pb-3">
              {isImage ? (
                <FileImage className="size-8 text-macaw-blue" />
              ) : (
                <FileText className="size-8 text-ecto-green" />
              )}
              <span className="text-caption font-bold text-ash">
                {customizeCopy.paperSize}
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="h-3.5 w-4/5 rounded-sm bg-midnight/80" />
              <div className="h-2.5 w-full rounded-sm bg-graphite/20" />
              <div className="h-2.5 w-11/12 rounded-sm bg-graphite/20" />
              <div className="h-2.5 w-3/4 rounded-sm bg-graphite/20" />
            </div>
          </div>
          <div className="mt-auto border-t border-graphite/15 pt-3 text-caption font-bold text-ash">
            {customizeCopy.pages(document.pageCount)}
          </div>
        </div>
      )}
    </div>
  )
}
