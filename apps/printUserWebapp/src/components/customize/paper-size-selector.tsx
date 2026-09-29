import { Check } from "lucide-react"
import { customizeCopy } from "../../data/customize-repository"

export function PaperSizeSelector({
  value = "A4",
  a3Enabled = false,
  onChange,
}: {
  value?: string
  a3Enabled?: boolean
  onChange?: (value: "A4" | "A3") => void
}) {
  const sizes: Array<{ id: "A4" | "A3"; hint: string; enabled: boolean }> = [
    { id: "A4", hint: customizeCopy.standardPaper, enabled: true },
    { id: "A3", hint: "Larger format", enabled: a3Enabled },
  ]
  return (
    <fieldset className="min-w-0 rounded-xl border border-graphite/20 bg-paper p-4 shadow-xs sm:p-5">
      <legend className="px-1 text-[15px] font-bold text-midnight">
        {customizeCopy.paperLegend}
      </legend>
      <div className="mt-3 grid min-w-0 gap-3">
        {sizes
          .filter((size) => size.enabled || size.id === "A4")
          .map((size) => (
            <button
              key={size.id}
              type="button"
              aria-pressed={value === size.id}
              disabled={!size.enabled}
              onClick={() => size.enabled && onChange?.(size.id)}
              className={`flex min-h-16 w-full min-w-0 items-center justify-between rounded-xl border-2 px-4 font-bold ${
                value === size.id
                  ? "border-macaw-blue bg-[#eaf8ff] text-eel-dark-blue shadow-2xs"
                  : "border-graphite/25 bg-paper text-charcoal"
              }`}
            >
              <span className="min-w-0 truncate">
                {size.id}
                <small className="block text-caption font-medium text-ash">
                  {size.enabled ? size.hint : "Not offered"}
                </small>
              </span>
              {value === size.id && (
                <Check className="size-5 shrink-0 stroke-[2.5] text-macaw-blue" />
              )}
            </button>
          ))}
      </div>
    </fieldset>
  )
}
