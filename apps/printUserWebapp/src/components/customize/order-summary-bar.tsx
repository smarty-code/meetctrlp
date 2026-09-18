import { Button } from "@ctrlp/ui/button"
import { Loader2 } from "lucide-react"
import { customizeCopy } from "../../data/customize-repository"

interface OrderSummaryBarProps {
  totalPages: number
  totalPrice: number
  isUpdating: boolean
  canContinue: boolean
  onContinue: () => void
}

export function OrderSummaryBar({
  totalPages,
  totalPrice,
  isUpdating,
  canContinue,
  onContinue,
}: OrderSummaryBarProps) {
  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-20 border-t border-graphite/20 bg-paper/95 px-4 pt-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur-md"
      aria-label={customizeCopy.orderSummary}
    >
      <div className="mx-auto flex max-w-3xl min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-caption font-bold tracking-caption text-ash uppercase">
            {customizeCopy.totalPages(totalPages)}
          </p>
          <p className="text-heading-sm font-bold text-midnight sm:text-heading">
            {isUpdating ? (
              <span className="inline-flex items-center gap-2 text-body">
                <Loader2 className="size-4 animate-spin text-ecto-green" />{" "}
                {customizeCopy.updatingPrice}
              </span>
            ) : (
              `₹${totalPrice}`
            )}
          </p>
        </div>
        <Button
          className="h-12 min-w-0 shrink-0 rounded-xl px-6 text-[16px] font-bold sm:min-w-36"
          disabled={!canContinue}
          onClick={onContinue}
        >
          {customizeCopy.continue}
        </Button>
      </div>
    </aside>
  )
}
