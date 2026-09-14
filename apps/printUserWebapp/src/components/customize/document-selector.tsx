import { Button } from '@ctrlp/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { customizeCopy } from '../../data/customize-repository';
import { ConfigurableDocument } from '../../types/upload';
import { DocumentPreview } from './document-preview';

interface DocumentSelectorProps {
  documents: ConfigurableDocument[];
  selectedId: string;
  previewPage: number;
  onSelect: (id: string) => void;
  onMove: (offset: number) => void;
  onPreviewPage: (page: number) => void;
  onRemove?: () => void;
  onPageCountDetected?: (docId: string, count: number) => void;
}

export function DocumentSelector({
  documents,
  selectedId,
  previewPage,
  onSelect,
  onPreviewPage,
  onRemove,
  onPageCountDetected,
}: DocumentSelectorProps) {
  const document = documents.find((item) => item.id === selectedId) ?? documents[0];

  return (
    <section
      className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-6 sm:py-8"
      aria-label={customizeCopy.preview}
    >
      <DocumentPreview
        document={document}
        previewPage={previewPage}
        onRemove={onRemove}
        onPageCountDetected={(count) => onPageCountDetected?.(document.id, count)}
      />

      {/* Document Indicator Dots */}
      <div className="flex items-center gap-2" aria-label={customizeCopy.selectDocument}>
        {documents.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.name}
            aria-pressed={item.id === selectedId}
            onClick={() => onSelect(item.id)}
            className={`h-2.5 rounded-full border border-graphite transition-all ${
              item.id === selectedId ? 'w-8 bg-ecto-green' : 'w-2.5 bg-paper'
            }`}
          />
        ))}
      </div>

      {/* Preview Page Controls */}
      {document.pageCount > 1 && (
        <div className="flex items-center gap-3 text-caption font-bold text-ash select-none">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={customizeCopy.previousDocument}
            onClick={() => onPreviewPage(Math.max(1, previewPage - 1))}
            disabled={previewPage <= 1}
          >
            <ChevronLeft />
          </Button>
          {customizeCopy.previewPageCount(previewPage, document.pageCount)}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={customizeCopy.nextDocument}
            onClick={() => onPreviewPage(Math.min(document.pageCount, previewPage + 1))}
            disabled={previewPage >= document.pageCount}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </section>
  );
}