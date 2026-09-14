import { Button } from '@ctrlp/ui/button';
import { Minus, Plus } from 'lucide-react';
import { ConfigurableDocument } from '../../types/upload';

interface DocumentConfigurationCardProps {
  document: ConfigurableDocument;
  fileIndex?: number;
  onRemove?: () => void;
  onCopiesChange: (copies: number) => void;
}

export function DocumentConfigurationCard({
  document,
  fileIndex = 1,
  onCopiesChange,
}: DocumentConfigurationCardProps) {
  return (
    <div className="w-full rounded-xl border border-graphite/20 bg-paper px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-3 lg:col-span-2 shadow-xs min-h-[64px]">
      {/* Left: Text Hierarchy (Title + Dynamic Subtitle) */}
      <div className="min-w-0">
        <span className="block text-body sm:text-[16px] font-bold text-midnight leading-snug">
          Number of copies
        </span>
        <small className="block text-caption font-medium text-ash mt-0.5">
          File {fileIndex} ({document.pageCount} {document.pageCount === 1 ? 'page' : 'pages'})
        </small>
      </div>

      {/* Right: Stepper Buttons */}
      <div className="flex items-center shrink-0">
        <div className="flex items-center gap-1 bg-graphite/5 rounded-lg border border-graphite/20 p-0.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Decrease copies"
            onClick={() => onCopiesChange(Math.max(1, document.configuration.copies - 1))}
            disabled={document.configuration.copies <= 1}
            className="size-8 rounded-md border-graphite/25 bg-paper hover:bg-graphite/10"
          >
            <Minus className="size-3.5 stroke-[2.5]" />
          </Button>
          <span className="w-7 text-center font-heading font-bold text-[15px] sm:text-[16px] text-midnight select-none">
            {document.configuration.copies}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Increase copies"
            onClick={() => onCopiesChange(document.configuration.copies + 1)}
            className="size-8 rounded-md border-graphite/25 bg-paper hover:bg-graphite/10"
          >
            <Plus className="size-3.5 stroke-[2.5]" />
          </Button>
        </div>
      </div>
    </div>
  );
}