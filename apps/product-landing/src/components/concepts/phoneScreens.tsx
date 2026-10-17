import { conceptCopy } from "@/content/concepts"
import { sampleData, type SampleDocument } from "@/content/sampleData"
import { PaymentChip, UiButton, Amount } from "@/components/concepts/parts"
import { documentSummary, copiesLabel } from "@/lib/concepts"
import { fill, formatRupees } from "@/lib/format"
import { cn } from "@/lib/cn"

const { phone, common, glyphs } = conceptCopy
const order = sampleData.primaryOrder

function ScreenHeader({
  title,
  aside,
}: {
  title: string
  aside?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
      <p className="text-ui-base font-semibold">{title}</p>
      {aside}
    </div>
  )
}

function DocumentRow({ doc }: { doc: SampleDocument }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-ui-lg bg-surface-sunken p-3">
      <div className="min-w-0">
        <p className="truncate text-ui-sm font-semibold">{doc.name}</p>
        <p className="mt-0.5 text-ui-2xs text-ink-soft">
          {documentSummary(doc)}
        </p>
      </div>
      <Amount className="text-ui-sm">{formatRupees(doc.price)}</Amount>
    </div>
  )
}

function TotalRow() {
  return (
    <div className="flex items-center justify-between border-t border-line pt-3">
      <span className="text-ui-sm text-ink-soft">{common.total}</span>
      <Amount className="text-ui-lg">{formatRupees(order.total)}</Amount>
    </div>
  )
}

function PayButtons({ pressed = false }: { pressed?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <UiButton pressed={pressed}>{phone.payUpi}</UiButton>
      <UiButton tone="outline">{phone.payAtShop}</UiButton>
    </div>
  )
}

/** Step 01: one uploaded file and room for more. */
export function UploadScreen() {
  const doc = sampleData.primaryDocument
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <ScreenHeader title={phone.yourDocuments} />
      <div className="flex items-center gap-3 rounded-ui-lg border border-line p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-ui bg-lime-soft text-ui-2xs font-semibold">
          {doc.size}
        </span>
        <div className="min-w-0">
          <p className="truncate text-ui-sm font-semibold">{doc.name}</p>
          <p className="text-ui-2xs text-ink-soft">
            {fill(common.pageCount, { count: doc.pages })}
          </p>
        </div>
        <span className="ms-auto text-ui-sm text-lime-deep">
          {glyphs.check}
        </span>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-ui-lg border border-dashed border-line p-3 text-ui-xs text-ink-soft">
        <span>{glyphs.plus}</span>
        {phone.addMore}
      </div>
      <UiButton className="mt-auto">{phone.continue}</UiButton>
    </div>
  )
}

/** Step 02: per-document settings, then the price summary. */
export function ConfigureScreen() {
  const doc = sampleData.primaryDocument
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <ScreenHeader title={phone.printSettings} />
      <p className="truncate text-ui-sm font-semibold">{doc.name}</p>
      <div className="grid grid-cols-2 rounded-ui bg-surface-sunken p-0.5 text-center text-ui-xs">
        <span className="rounded-ui bg-surface py-1.5 font-semibold">
          {common.colour}
        </span>
        <span className="py-1.5 text-ink-soft">{common.bw}</span>
      </div>
      <SettingRow label={phone.copies}>
        <span className="flex items-center gap-3 rounded-ui border border-line px-2 py-0.5">
          <span className="text-ink-soft">{phone.decrease}</span>
          <span className="font-semibold tabular">{doc.copies}</span>
          <span className="text-ink-soft">{phone.increase}</span>
        </span>
      </SettingRow>
      <SettingRow label={phone.paperSize}>{doc.size}</SettingRow>
      <SettingRow label={phone.pages}>{common.allPages}</SettingRow>
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center justify-between text-ui-2xs text-ink-soft">
          <span className="truncate">{sampleData.secondaryDocument.name}</span>
          <span>{copiesLabel(sampleData.secondaryDocument.copies)}</span>
        </div>
        <TotalRow />
        <PayButtons />
      </div>
    </div>
  )
}

function SettingRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between text-ui-xs">
      <span className="text-ink-soft">{label}</span>
      <span className="font-semibold">{children}</span>
    </div>
  )
}

/** Hero: review both documents and pay. */
export function PayScreen({ pressed }: { pressed: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <ScreenHeader title={phone.reviewOrder} />
      {sampleData.documents.map((doc) => (
        <DocumentRow key={doc.name} doc={doc} />
      ))}
      <div className="mt-auto flex flex-col gap-3">
        <TotalRow />
        <PayButtons pressed={pressed} />
      </div>
    </div>
  )
}

/** Step 05 and Customers: order tracking checklist. */
export function TrackScreen() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <ScreenHeader
        title={fill(phone.orderTitle, { id: order.id })}
        aside={<PaymentChip payment={order.payment} />}
      />
      <ol className="flex flex-col gap-4">
        {phone.trackSteps.map((step, index) => {
          const done = index < phone.trackActiveIndex
          const active = index === phone.trackActiveIndex
          return (
            <li
              key={step}
              className={cn(
                "flex items-center gap-3 text-ui-sm",
                active && "font-semibold",
                !done && !active && "text-ink-faint"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-pill text-ui-2xs",
                  done && "bg-lime-soft text-lime-deep",
                  active && "bg-lime text-ink",
                  !done && !active && "border border-line"
                )}
              >
                {done ? glyphs.check : active ? glyphs.dot : glyphs.ring}
              </span>
              {step}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
