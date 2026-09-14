import { Button } from '@ctrlp/ui/button';
import { customizeCopy } from '../../data/customize-repository';

export function ApplyToAll({ onApply }: { onApply: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-ecto-green/40 bg-eel-light/60 p-4 sm:p-5 lg:col-span-2 shadow-xs">
      <div>
        <p className="font-heading font-bold text-midnight text-[15px] sm:text-[16px]">{customizeCopy.applyAll}</p>
        <p className="text-caption text-graphite mt-0.5">{customizeCopy.applyAllHint}</p>
      </div>
      <Button variant="outline" className="border-ecto-green text-midnight hover:bg-ecto-green/10" onClick={onApply}>
        {customizeCopy.apply}
      </Button>
    </div>
  );
}