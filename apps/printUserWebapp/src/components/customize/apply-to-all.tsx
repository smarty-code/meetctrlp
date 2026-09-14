import { Button } from '@ctrlp/ui/button';
import { customizeCopy } from '../../data/customize-repository';

export function ApplyToAll({ onApply }: { onApply: () => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-xl border-2 border-lingot-lime bg-paper p-4 sm:p-5 lg:col-span-2"><div><p className="font-bold text-midnight">{customizeCopy.applyAll}</p><p className="text-caption text-ash">{customizeCopy.applyAllHint}</p></div><Button variant="outline" onClick={onApply}>{customizeCopy.apply}</Button></div>;
}