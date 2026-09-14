import { Check } from 'lucide-react';
import { customizeCopy } from '../../data/customize-repository';

export function PaperSizeSelector() {
  return <fieldset className="min-w-0 rounded-xl border-2 border-graphite p-4 sm:p-5"><legend className="px-1 font-bold text-midnight">{customizeCopy.paperLegend}</legend><button type="button" aria-pressed="true" className="mt-3 flex min-h-16 w-full min-w-0 items-center justify-between rounded-xl border-2 border-macaw-blue bg-[#eaf8ff] px-4 font-bold text-eel-dark-blue"><span className="min-w-0 truncate">{customizeCopy.paperSize}<small className="block text-caption font-medium text-ash">{customizeCopy.standardPaper}</small></span><Check className="size-5 shrink-0" /></button></fieldset>;
}