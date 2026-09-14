import { Button } from "@ctrlp/ui/button"
import { Minus, Plus } from "lucide-react"
import { ConfigurableDocument } from "../../types/upload"

interface DocumentConfigurationCardProps {
  document: ConfigurableDocument
  fileIndex?: number
  onRemove?: () => void
  onCopiesChange: (copies: number) => void
}

export function DocumentConfigurationCard({
  document,
  fileIndex = 1,
  onCopiesChange,
}: DocumentConfigurationCardProps) {
  return (
    <div className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl border border-graphite/20 bg-paper px-4 py-3.5 shadow-xs sm:px-5 sm:py-4 lg:col-span-2">
      {/* Left: Text Hierarchy (Title + Dynamic Subtitle) */}
      <div className="min-w-0">
        <span className="block text-body leading-snug font-bold text-midnight sm:text-[16px]">
          Number of copies
        </span>
        <small className="mt-0.5 block text-caption font-medium text-ash">
          File {fileIndex} ({document.pageCount}{" "}
          {document.pageCount === 1 ? "page" : "pages"})
        </small>
      </div>

      {/* Right: Stepper Buttons */}
      <div className="flex shrink-0 items-center">
        <div className="flex items-center gap-1 rounded-lg border border-graphite/20 bg-graphite/5 p-0.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Decrease copies"
            onClick={() =>
              onCopiesChange(Math.max(1, document.configuration.copies - 1))
            }
            disabled={document.configuration.copies <= 1}
            className="size-8 rounded-md border-graphite/25 bg-paper hover:bg-graphite/10"
          >
            <Minus className="size-3.5 stroke-[2.5]" />
          </Button>
          <span className="w-7 text-center font-heading text-[15px] font-bold text-midnight select-none sm:text-[16px]">
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
  )
}
