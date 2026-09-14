import { Check, RectangleVertical, RectangleHorizontal } from 'lucide-react';
import { Orientation } from '../../types/upload';
import { customizeCopy } from '../../data/customize-repository';

export function OrientationSelector({
  value,
  onChange,
}: {
  value: Orientation;
  onChange: (value: Orientation) => void;
}) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-graphite/20 bg-paper p-4 sm:p-5 shadow-xs">
      <legend className="px-1 text-[15px] font-bold text-midnight">
        {customizeCopy.orientationLegend}
      </legend>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-3">
        {(['portrait', 'landscape'] as const).map((mode) => (
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
            <div className="flex items-center gap-2.5 min-w-0">
              {mode === 'portrait' ? (
                <RectangleVertical className="size-5 shrink-0 text-macaw-blue stroke-[2.2]" />
              ) : (
                <RectangleHorizontal className="size-5 shrink-0 text-macaw-blue stroke-[2.2]" />
              )}
              <span className="min-w-0 truncate">
                {mode === 'portrait' ? customizeCopy.portrait : customizeCopy.landscape}
                <small className="block text-caption font-medium text-ash">
                  {mode === 'portrait' ? customizeCopy.portraitHint : customizeCopy.landscapeHint}
                </small>
              </span>
            </div>
            {value === mode && <Check className="size-5 shrink-0 text-macaw-blue stroke-[2.5]" />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
