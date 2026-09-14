import { X, FileImage, FileText } from 'lucide-react';
import { ConfigurableDocument } from '../../types/upload';
import { customizeCopy } from '../../data/customize-repository';
import { PdfCanvasPreview } from './pdf-canvas-preview';

interface DocumentPreviewProps {
  document: ConfigurableDocument;
  previewPage?: number;
  onRemove?: () => void;
  onPageCountDetected?: (count: number) => void;
}

export function DocumentPreview({
  document,
  previewPage = 1,
  onRemove,
  onPageCountDetected,
}: DocumentPreviewProps) {
  const isImage = document.type.startsWith('image/');
  const isPdf =
    document.type === 'application/pdf' || document.name.toLowerCase().endsWith('.pdf');
  const previewUrl = document.previewUrl;

  return (
    <div className="relative aspect-3/4 w-full max-w-72 sm:max-w-80 overflow-hidden rounded-xl border-2 border-graphite bg-paper text-midnight select-none flex flex-col shadow-xs">
      {/* Remove Cross Button placed directly on the main canvas */}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove document"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2.5 right-2.5 z-20 size-7.5 rounded-full bg-paper/90 border border-graphite/30 flex items-center justify-center text-graphite hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all shadow-xs"
        >
          <X className="size-4 stroke-[2.4]" />
        </button>
      )}

      {/* Real Image Rendering directly onto the main canvas */}
      {isImage && previewUrl ? (
        <div className="w-full h-full flex items-center justify-center overflow-hidden p-3 bg-paper">
          <img
            src={previewUrl}
            alt={document.name}
            className="w-full h-full object-contain"
          />
        </div>
      ) : isPdf && (document.file || previewUrl) ? (
        /* Real PDF Canvas Rendering directly onto the main canvas */
        <div className="w-full h-full overflow-hidden relative bg-paper">
          <PdfCanvasPreview
            file={document.file}
            previewUrl={previewUrl}
            pageNumber={previewPage}
            onPageCountDetected={onPageCountDetected}
          />
        </div>
      ) : (
        /* Fallback Mock Sheet directly on the main canvas (no nested border) */
        <div className="flex h-full flex-col justify-between p-4 sm:p-5 bg-paper">
          <div>
            <div className="flex items-center justify-between border-b-2 border-ecto-green pb-3">
              {isImage ? (
                <FileImage className="size-8 text-macaw-blue" />
              ) : (
                <FileText className="size-8 text-ecto-green" />
              )}
              <span className="text-caption font-bold text-ash">{customizeCopy.paperSize}</span>
            </div>
            <div className="space-y-2.5 mt-4">
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
  );
}