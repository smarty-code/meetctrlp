import { Button } from '@ctrlp/ui/button';
import { Loader2 } from 'lucide-react';
import { customizeCopy } from '../../data/customize-repository';

interface OrderSummaryBarProps { totalPages: number; totalPrice: number; isUpdating: boolean; canContinue: boolean; onContinue: () => void; }

export function OrderSummaryBar({ totalPages, totalPrice, isUpdating, canContinue, onContinue }: OrderSummaryBarProps) {
  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-20 border-t border-graphite/20 bg-paper/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3.5 backdrop-blur-md shadow-lg"
      aria-label={customizeCopy.orderSummary}
    >
      <div className="mx-auto flex min-w-0 max-w-3xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-caption font-bold uppercase text-ash tracking-caption">
            {customizeCopy.totalPages(totalPages)}
          </p>
          <p className="text-heading-sm sm:text-heading font-bold text-midnight">
            {isUpdating ? (
              <span className="inline-flex items-center gap-2 text-body">
                <Loader2 className="size-4 animate-spin text-ecto-green" /> {customizeCopy.updatingPrice}
              </span>
            ) : (
              `₹${totalPrice}`
            )}
          </p>
        </div>
        <Button
          className="min-w-0 shrink-0 px-6 sm:min-w-36 h-12 rounded-xl text-[16px] font-bold"
          disabled={!canContinue}
          onClick={onContinue}
        >
          {customizeCopy.continue}
        </Button>
      </div>
    </aside>
  );
}