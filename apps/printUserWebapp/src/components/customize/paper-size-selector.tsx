import { Check } from "lucide-react"
import { customizeCopy } from "../../data/customize-repository"

export function PaperSizeSelector() {
  return (
    <fieldset className="min-w-0 rounded-xl border border-graphite/20 bg-paper p-4 shadow-xs sm:p-5">
      <legend className="px-1 text-[15px] font-bold text-midnight">
        {customizeCopy.paperLegend}
      </legend>
      <button
        type="button"
        aria-pressed="true"
        className="mt-3 flex min-h-16 w-full min-w-0 cursor-default items-center justify-between rounded-xl border-2 border-macaw-blue bg-[#eaf8ff] px-4 font-bold text-eel-dark-blue shadow-2xs"
      >
        <span className="min-w-0 truncate">
          {customizeCopy.paperSize}
          <small className="block text-caption font-medium text-ash">
            {customizeCopy.standardPaper}
          </small>
        </span>
        <Check className="size-5 shrink-0 stroke-[2.5] text-macaw-blue" />
      </button>
    </fieldset>
  )
}
