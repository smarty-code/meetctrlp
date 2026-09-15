import { Button } from '@ctrlp/ui/button';
import { Loader2 } from 'lucide-react';
import { customizeCopy } from '../../data/customize-repository';

interface OrderSummaryBarProps { totalPages: number; totalPrice: number; isUpdating: boolean; canContinue: boolean; onContinue: () => void; }

export function OrderSummaryBar({ totalPages, totalPrice, isUpdating, canContinue, onContinue }: OrderSummaryBarProps) {
  return <aside className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-graphite bg-paper/95 px-4 py-4 backdrop-blur-sm" aria-label={customizeCopy.orderSummary}><div className="mx-auto flex max-w-3xl items-center justify-between gap-4"><div><p className="text-caption font-bold uppercase text-ash">{customizeCopy.totalPages(totalPages)}</p><p className="text-heading-sm font-bold text-midnight">{isUpdating ? <span className="inline-flex items-center gap-2 text-body"><Loader2 className="size-4 animate-spin" /> {customizeCopy.updatingPrice}</span> : `₹${totalPrice}`}</p></div><Button className="min-w-36" disabled={!canContinue} onClick={onContinue}>{customizeCopy.continue}</Button></div></aside>;
}