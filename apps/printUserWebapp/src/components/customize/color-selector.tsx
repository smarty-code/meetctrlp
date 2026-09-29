import { Check } from "lucide-react"
import { customizeConfig, customizeCopy } from "../../data/customize-repository"
import { ColorMode } from "../../types/upload"

export function ColorSelector({
  value,
  onChange,
  colorEnabled = true,
  bwPrice,
  colorPrice,
}: {
  value: ColorMode
  onChange: (value: ColorMode) => void
  colorEnabled?: boolean
  bwPrice?: number
  colorPrice?: number
}) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-graphite/20 bg-paper p-4 shadow-xs sm:p-5">
      <legend className="px-1 text-[15px] font-bold text-midnight">
        {customizeCopy.colorLegend}
      </legend>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
        {(["bw", "color"] as const).map((mode) => {
          const disabled = mode === "color" && !colorEnabled
          const price =
            mode === "bw"
              ? (bwPrice ?? customizeConfig.pricePerPage.bw)
              : (colorPrice ?? customizeConfig.pricePerPage.color)
          return (
          <button
            key={mode}
            type="button"
            aria-pressed={value === mode}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(mode)
            }}
            className={`flex min-h-16 min-w-0 items-center justify-between rounded-xl border-2 px-3.5 text-left font-bold transition-all active:scale-[0.99] sm:px-4 ${
              disabled
                ? "cursor-not-allowed border-graphite/15 bg-eel-light/20 text-ash"
                : value === mode
                ? "border-macaw-blue bg-[#eaf8ff] text-eel-dark-blue shadow-2xs"
                : "border-graphite/25 bg-paper text-charcoal hover:border-graphite/40"
            }`}
          >
            <span className="min-w-0 truncate">
              {mode === "bw"
                ? customizeCopy.blackAndWhite
                : customizeCopy.color}
              <small className="block text-caption font-medium text-ash">
                {disabled ? "Not offered" : customizeCopy.perPage(price)}
              </small>
            </span>
            {value === mode && !disabled && (
              <Check className="size-5 shrink-0 stroke-[2.5] text-macaw-blue" />
            )}
          </button>
          )
        })}
      </div>
    </fieldset>
  )
}
