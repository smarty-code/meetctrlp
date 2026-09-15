import { Button } from "@ctrlp/ui/button"
import { ArrowLeft, Upload } from "lucide-react"
import { customizeConfig, customizeCopy } from "../../data/customize-repository"

interface CustomizeHeaderProps {
  onBack: () => void
  onAddFiles: (files: FileList | null) => void
  fileInputRef?: React.RefObject<HTMLInputElement | null>
}

export function CustomizeHeader({
  onBack,
  onAddFiles,
  fileInputRef,
}: CustomizeHeaderProps) {
  return (
    <header className="flex min-w-0 items-center gap-2 border-b-2 border-graphite/15 py-4">
      <Button
        variant="ghost"
        size="icon"
        aria-label={customizeCopy.back}
        onClick={onBack}
      >
        <ArrowLeft className="size-5" />
      </Button>
      <p className="min-w-0 flex-1 truncate text-center text-heading-sm font-bold text-midnight">
        {customizeCopy.title}
      </p>
      <label
        htmlFor="header-file-upload-input"
        className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-macaw-blue bg-paper px-3.5 py-1.5 text-xs font-bold text-macaw-blue shadow-2xs transition-all select-none hover:bg-[#eaf8ff] active:scale-95 active:bg-[#d6f0ff] sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
      >
        <Upload className="size-4 stroke-[2.5] text-macaw-blue" />
        <span className="truncate tracking-wide">{customizeCopy.addFiles}</span>
      </label>
      <input
        id="header-file-upload-input"
        ref={fileInputRef}
        type="file"
        multiple
        accept={customizeConfig.acceptedFileTypes}
        className="hidden"
        onChange={(event) => {
          onAddFiles(event.target.files)
          event.target.value = ""
        }}
      />
    </header>
  )
}
