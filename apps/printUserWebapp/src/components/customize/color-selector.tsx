import { Check } from 'lucide-react';
import { customizeConfig, customizeCopy } from '../../data/customize-repository';
import { ColorMode } from '../../types/upload';

export function ColorSelector({ value, onChange }: { value: ColorMode; onChange: (value: ColorMode) => void }) {
  return <fieldset className="rounded-xl border-2 border-graphite p-4 sm:p-5"><legend className="px-1 font-bold text-midnight">{customizeCopy.colorLegend}</legend><div className="mt-3 grid grid-cols-2 gap-3">{(['bw', 'color'] as const).map((mode) => <button key={mode} type="button" aria-pressed={value === mode} onClick={() => onChange(mode)} className={`flex min-h-16 items-center justify-between rounded-xl border-2 px-4 text-left font-bold transition-colors ${value === mode ? 'border-macaw-blue bg-[#eaf8ff] text-eel-dark-blue' : 'border-graphite/30 text-charcoal'}`}><span>{mode === 'bw' ? customizeCopy.blackAndWhite : customizeCopy.color}<small className="block text-caption font-medium text-ash">{customizeCopy.perPage(customizeConfig.pricePerPage[mode])}</small></span>{value === mode && <Check className="size-5" />}</button>)}</div></fieldset>;
}