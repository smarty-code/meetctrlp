import { Check } from 'lucide-react';
import { customizeConfig, customizeCopy } from '../../data/customize-repository';
import { ColorMode } from '../../types/upload';

export function ColorSelector({ value, onChange }: { value: ColorMode; onChange: (value: ColorMode) => void }) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-graphite/20 bg-paper p-4 sm:p-5 shadow-xs">
      <legend className="px-1 text-[15px] font-bold text-midnight">{customizeCopy.colorLegend}</legend>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
        {(['bw', 'color'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
            className={`flex min-h-16 min-w-0 items-center justify-between rounded-xl border-2 px-3.5 text-left font-bold transition-all sm:px-4 active:scale-[0.99] ${
              value === mode
                ? 'border-macaw-blue bg-[#eaf8ff] text-eel-dark-blue shadow-2xs'
                : 'border-graphite/25 bg-paper text-charcoal hover:border-graphite/40'
            }`}
          >
            <span className="min-w-0 truncate">
              {mode === 'bw' ? customizeCopy.blackAndWhite : customizeCopy.color}
              <small className="block text-caption font-medium text-ash">
                {customizeCopy.perPage(customizeConfig.pricePerPage[mode])}
              </small>
            </span>
            {value === mode && <Check className="size-5 shrink-0 text-macaw-blue stroke-[2.5]" />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}