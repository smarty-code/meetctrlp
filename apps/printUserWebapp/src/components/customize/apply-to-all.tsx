import { Button } from "@ctrlp/ui/button"
import { customizeCopy } from "../../data/customize-repository"

export function ApplyToAll({ onApply }: { onApply: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-ecto-green/40 bg-eel-light/60 p-4 shadow-xs sm:p-5 lg:col-span-2">
      <div>
        <p className="font-heading text-[15px] font-bold text-midnight sm:text-[16px]">
          {customizeCopy.applyAll}
        </p>
        <p className="mt-0.5 text-caption text-graphite">
          {customizeCopy.applyAllHint}
        </p>
      </div>
      <Button
        variant="outline"
        className="border-ecto-green text-midnight hover:bg-ecto-green/10"
        onClick={onApply}
      >
        {customizeCopy.apply}
      </Button>
    </div>
  )
}
