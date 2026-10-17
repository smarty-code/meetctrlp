import { conceptCopy } from "@/content/concepts"
import { sampleData } from "@/content/sampleData"
import { Chip } from "@/components/ui/Chip"
import {
  Amount,
  PanelTitle,
  PaymentChip,
  PrintingChip,
  ProgressBar,
  StatusDot,
  UiButton,
} from "@/components/concepts/parts"
import {
  colourLabel,
  copiesLabel,
  documentSummary,
  pageRangeLabel,
} from "@/lib/concepts"
import { fill, formatRupees } from "@/lib/format"
import { cn } from "@/lib/cn"

const { desktop, status, common, glyphs } = conceptCopy
const primary = sampleData.primaryOrder
const secondary = sampleData.secondaryOrder
const doc = sampleData.primaryDocument
const colourPrinter = sampleData.colourPrinter

export type QueueState = {
  /** Whether #CP10482 has reached the "New orders" list. */
  arrived?: boolean
  print?: "none" | "queued" | "printing"
  /** Right-hand panel: the print queue, or the order detail with "Accept order". */
  panel?: "queue" | "accept"
}

export type JobState = "accept" | "printing"

function OrderRow({
  order,
  selected = false,
}: {
  order: typeof primary | typeof secondary
  selected?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-ui border px-3 py-2.5 text-ui-xs transition-colors duration-standard",
        selected ? "border-lime bg-lime-soft" : "border-line"
      )}
    >
      <span className="font-semibold tabular">{order.id}</span>
      <Amount className="ms-auto text-ink-soft">
        {formatRupees(order.total)}
      </Amount>
      <PaymentChip payment={order.payment} />
    </div>
  )
}

function PrinterStatus() {
  return (
    <p className="flex items-center justify-end gap-1.5 text-ui-2xs text-ink-soft">
      <StatusDot />
      {fill(desktop.printerLine, {
        printer: colourPrinter.name,
        status: common.connected,
      })}
    </p>
  )
}

export function QueueScreen({ state }: { state: QueueState }) {
  const { arrived = true, print = "printing", panel = "queue" } = state
  return (
    <div className="grid flex-1 grid-cols-2">
      <div className="flex flex-col gap-2 border-e border-line p-4">
        <PanelTitle>{desktop.newOrders}</PanelTitle>
        <div
          className={cn(
            "transition-all duration-scene ease-standard",
            arrived ? "opacity-100" : "-translate-y-2 opacity-0"
          )}
        >
          <OrderRow order={primary} selected />
        </div>
        <OrderRow order={secondary} />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <PrinterStatus />
        {panel === "accept" ? <AcceptPanel /> : <PrintQueue print={print} />}
      </div>
    </div>
  )
}

function PrintQueue({ print }: { print: NonNullable<QueueState["print"]> }) {
  return (
    <div className="flex flex-col gap-2">
      <PanelTitle>{desktop.printQueue}</PanelTitle>
      {print !== "none" && (
        <div className="flex flex-col gap-2 rounded-ui border border-line p-3">
          <div className="flex items-center gap-2 text-ui-xs">
            <span className="font-semibold tabular">{primary.id}</span>
            <span className="ms-auto">
              {print === "printing" ? (
                <PrintingChip />
              ) : (
                <Chip>{status.queued}</Chip>
              )}
            </span>
          </div>
          {print === "printing" && <ProgressBar />}
        </div>
      )}
    </div>
  )
}

function AcceptPanel() {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-ui border border-line p-3">
      <div className="flex items-center justify-between">
        <span className="text-ui-sm font-semibold tabular">
          {fill(desktop.orderDetail, { id: primary.id })}
        </span>
        <PaymentChip payment={primary.payment} />
      </div>
      {sampleData.documents.map((item) => (
        <div
          key={item.name}
          className="flex justify-between gap-2 text-ui-2xs text-ink-soft"
        >
          <span className="truncate">{item.name}</span>
          <Amount>{formatRupees(item.price)}</Amount>
        </div>
      ))}
      <UiButton className="mt-auto">{desktop.acceptOrder}</UiButton>
    </div>
  )
}

export function JobScreen({ state }: { state: JobState }) {
  const summary = fill(desktop.jobSummary, {
    printer: colourPrinter.name,
    colour: colourLabel(doc.colour),
    size: doc.size,
    copies: copiesLabel(doc.copies),
    pages: pageRangeLabel(doc.pageRange),
  })
  return (
    <div className="flex flex-1 flex-col justify-center gap-3 p-5">
      <PanelTitle>{desktop.printJob}</PanelTitle>
      <p className="text-ui-sm font-semibold">{summary}</p>
      {state === "accept" ? (
        <UiButton className="self-start">{desktop.acceptOrder}</UiButton>
      ) : (
        <div className="flex flex-col gap-2">
          <PrintingChip />
          <ProgressBar />
        </div>
      )}
    </div>
  )
}

export function PaymentScreen() {
  return (
    <div className="flex flex-1 flex-col gap-2 p-4">
      <PanelTitle>{desktop.paymentsTitle}</PanelTitle>
      <OrderRow order={primary} />
      <OrderRow order={secondary} />
    </div>
  )
}

export function RoutingScreen() {
  return (
    <div className="flex flex-1 flex-col gap-2 p-4">
      <PanelTitle>{desktop.routingTitle}</PanelTitle>
      {sampleData.printers.map((printer) => (
        <div
          key={printer.name}
          className="flex items-center gap-2 rounded-ui border border-line px-3 py-2.5 text-ui-xs"
        >
          <span className="font-semibold">
            {fill(desktop.routingRule, {
              colour: printer.colour ? common.colour : common.bw,
              size: sampleData.paperSizes[0],
            })}
          </span>
          <span className="text-lime-deep">{glyphs.arrow}</span>
          <span className="truncate text-ink-soft">{printer.name}</span>
        </div>
      ))}
    </div>
  )
}

export function FailureScreen() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-ui-xs">
        <span className="font-semibold tabular">{secondary.id}</span>
        <Chip tone="error" className="ms-auto">
          {status.failed}
        </Chip>
      </div>
      <p className="text-ui-2xs text-ink-soft">
        {documentSummary(sampleData.secondaryDocument)}
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <UiButton tone="ink">{desktop.retry}</UiButton>
        <UiButton tone="outline">{desktop.changePrinter}</UiButton>
      </div>
    </div>
  )
}

export function PricingScreen() {
  const rates = [
    { label: desktop.pricingBw, amount: sampleData.rates.bw },
    { label: desktop.pricingColour, amount: sampleData.rates.colour },
  ]
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <PanelTitle>{desktop.pricingTitle}</PanelTitle>
        <Chip>{conceptCopy.tag.sample}</Chip>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rates.map((rate) => (
          <div key={rate.label} className="flex flex-col gap-1">
            <span className="text-ui-2xs text-ink-soft">{rate.label}</span>
            <span className="flex items-baseline gap-1 rounded-ui border border-line px-3 py-2">
              <Amount className="text-ui-base">
                {formatRupees(rate.amount)}
              </Amount>
              <span className="text-ui-2xs text-ink-faint">
                {common.perPage}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgentScreen() {
  const columns = [common.colour, common.bw, ...sampleData.paperSizes]
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <PanelTitle>{desktop.printersTitle}</PanelTitle>
      {sampleData.printers.map((printer) => (
        <div key={printer.name} className="flex items-center gap-2 text-ui-xs">
          <StatusDot />
          <span className="font-semibold">{printer.name}</span>
          <span className="ms-auto text-ink-soft">{common.connected}</span>
        </div>
      ))}
      <table className="w-full border-t border-line text-ui-2xs">
        <caption className="sr-only">{desktop.capabilities}</caption>
        <thead>
          <tr className="text-ink-faint">
            <th scope="col" className="py-2 text-start font-medium">
              <span className="sr-only">{desktop.printersTitle}</span>
            </th>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="py-2 text-center font-medium"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sampleData.printers.map((printer) => {
            const supports = [
              printer.colour,
              printer.mono,
              ...sampleData.paperSizes.map((size) =>
                (printer.sizes as readonly string[]).includes(size)
              ),
            ]
            return (
              <tr key={printer.name} className="border-t border-line">
                <th
                  scope="row"
                  className="truncate py-2 text-start font-semibold"
                >
                  {printer.name}
                </th>
                {supports.map((ok, index) => (
                  <td
                    key={columns[index]}
                    className={cn(
                      "py-2 text-center",
                      ok ? "text-lime-deep" : "text-ink-faint"
                    )}
                  >
                    {ok ? glyphs.check : glyphs.cross}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
