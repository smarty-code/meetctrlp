import { Input } from "@ctrlp/ui/input"
import { customizeCopy } from "../../data/customize-repository"
import { PageSelectionMode } from "../../types/upload"

interface PageSelectionControlProps {
  mode: PageSelectionMode
  expression: string
  pageCount: number
  onChange: (mode: PageSelectionMode, expression: string) => void
  isValid: boolean
}

export function PageSelectionControl({
  mode,
  expression,
  pageCount,
  onChange,
  isValid,
}: PageSelectionControlProps) {
  return (
    <fieldset className="rounded-xl border border-graphite/20 bg-paper p-4 shadow-xs sm:p-5 lg:col-span-2">
      <legend className="px-1 text-[15px] font-bold text-midnight">
        {customizeCopy.pageSelectionLegend}
      </legend>
      <div className="mt-3 flex flex-wrap gap-3">
        {(["all", "selected"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => onChange(option, option === "all" ? "" : expression)}
            className={`rounded-xl border-2 px-4 py-2.5 font-bold transition-all active:scale-[0.99] ${
              mode === option
                ? "border-macaw-blue bg-[#eaf8ff] text-eel-dark-blue shadow-2xs"
                : "border-graphite/25 bg-paper text-charcoal hover:border-graphite/40"
            }`}
          >
            {option === "all"
              ? customizeCopy.allPages
              : customizeCopy.selectedPages}
          </button>
        ))}
      </div>
      {mode === "selected" && (
        <div className="mt-4">
          <label
            htmlFor="page-expression"
            className="text-caption font-bold text-ash"
          >
            {customizeCopy.pagesToPrint}
          </label>
          <Input
            id="page-expression"
            value={expression}
            placeholder={customizeCopy.pagePlaceholder}
            onChange={(event) => onChange("selected", event.target.value)}
            aria-invalid={Boolean(expression) && !isValid}
            className="mt-1.5 max-w-sm rounded-xl"
          />
          {expression && !isValid && (
            <p className="mt-2 text-caption font-bold text-destructive">
              {customizeCopy.pageError(pageCount)}
            </p>
          )}
        </div>
      )}
    </fieldset>
  )
}
