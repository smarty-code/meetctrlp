import { conceptCopy } from "@/content/concepts"
import { sampleData } from "@/content/sampleData"
import { Amount, PaymentChip } from "@/components/concepts/parts"
import { documentSummary } from "@/lib/concepts"
import { fill, formatRupees } from "@/lib/format"
import { cn } from "@/lib/cn"

const order = sampleData.primaryOrder

/** One structured order: the clean state of the Problem visual (PRD 5.4). */
export function OrderCard({ className }: { className?: string }) {
  return (
    <div className={cn("@container w-full", className)}>
      <div className="flex flex-col gap-3 rounded-desktop border border-line bg-surface p-5 text-ink shadow-card concept-panel">
        <div className="flex items-center justify-between">
          <p className="text-ui-base font-semibold tabular">
            {fill(conceptCopy.phone.orderTitle, { id: order.id })}
          </p>
          <PaymentChip payment={order.payment} />
        </div>
        {sampleData.documents.map((doc) => (
          <div
            key={doc.name}
            className="flex items-start justify-between gap-3 border-t border-line pt-3"
          >
            <div className="min-w-0">
              <p className="truncate text-ui-sm font-semibold">{doc.name}</p>
              <p className="text-ui-2xs text-ink-soft">
                {documentSummary(doc)}
              </p>
            </div>
            <Amount className="text-ui-sm">{formatRupees(doc.price)}</Amount>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="text-ui-xs text-ink-soft">
            {conceptCopy.common.total}
          </span>
          <Amount className="text-ui-lg">{formatRupees(order.total)}</Amount>
        </div>
      </div>
    </div>
  )
}
