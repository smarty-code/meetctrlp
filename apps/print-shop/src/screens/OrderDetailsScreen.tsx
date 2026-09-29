import { useEffect, useState } from "react"
import { Badge } from "@ctrlp/ui/badge"
import { Button } from "@ctrlp/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ctrlp/ui/card"

import type { CloudPrintJob, Printer, ShopOrder } from "../lib/protocol"

export function OrderDetailsScreen({
  order,
  jobs,
  printers,
  busy,
  onBack,
  onAccept,
  onReject,
  onDispatch,
  onReady,
  onComplete,
  onCollectCash,
  onPreview,
}: {
  order: ShopOrder
  jobs: CloudPrintJob[]
  printers: Printer[]
  busy: boolean
  onBack: () => void
  onAccept: () => void
  onReject: () => void
  onDispatch: (documentId: string) => void
  onReady: () => void
  onComplete: () => void
  onCollectCash: () => void
  onPreview: (documentId: string) => Promise<{ valid: boolean; message: string }>
}) {
  const [validation, setValidation] = useState<Record<string, string>>({})
  const readyPrinter = printers.find((printer) => printer.enabled !== false && printer.cloudId)

  useEffect(() => {
    setValidation({})
  }, [order.id])

  return (
    <div className="space-y-4">
      <Button variant="outline" className="rounded-[12px]" onClick={onBack}>
        Back to orders
      </Button>
      <Card className="rounded-[12px]">
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>{order.orderNumber}</CardTitle>
            <CardDescription>
              {order.payment.method} · {order.payment.status} · ₹{(order.amounts.totalMinorUnits / 100).toFixed(2)}
            </CardDescription>
          </div>
          <Badge>{order.status}</Badge>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {order.status === "SUBMITTED" ? (
            <>
              <Button className="rounded-[12px]" disabled={busy} onClick={onAccept}>Accept order</Button>
              <Button variant="destructive" className="rounded-[12px]" disabled={busy} onClick={onReject}>Reject order</Button>
            </>
          ) : null}
          {order.status === "PRINTING" ? (
            <Button className="rounded-[12px]" disabled={busy || jobs.some((job) => job.status !== "COMPLETED")} onClick={onReady}>
              Mark ready for pickup
            </Button>
          ) : null}
          {order.status === "READY" ? (
            <>
              {order.payment.method === "CASH" && order.payment.status !== "PAID" ? (
                <Button className="rounded-[12px]" disabled={busy} onClick={onCollectCash}>
                  Record cash received
                </Button>
              ) : null}
              <Button className="rounded-[12px]" disabled={busy || (order.payment.method === "CASH" && order.payment.status !== "PAID")} onClick={onComplete}>
                Complete handover
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      {order.documents.map((document) => {
        const documentId = document.docId ?? document.id
        const documentJobs = jobs.filter((job) => job.documentId === documentId)
        return (
          <Card key={documentId} className="rounded-[12px]">
            <CardHeader>
              <CardTitle>{document.originalFilename}</CardTitle>
              <CardDescription>
                {document.pageCount} pages · {document.copies} copies · {document.colorMode} · {document.paperSize} ·{" "}
                {document.config?.pageSelection ?? "all pages"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {validation[documentId] ? <p className="text-caption text-ash">{validation[documentId]}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-[12px]"
                  onClick={() => {
                    void onPreview(documentId).then((result) =>
                      setValidation((current) => ({ ...current, [documentId]: result.message }))
                    )
                  }}
                >
                  Validate & preview
                </Button>
                {order.status === "SHOP_ACCEPTED" && documentJobs.length === 0 ? (
                  <Button
                    size="sm"
                    className="rounded-[12px]"
                    disabled={busy || !readyPrinter}
                    onClick={() => onDispatch(documentId)}
                  >
                    {readyPrinter ? "Start printing" : "No compatible printer"}
                  </Button>
                ) : null}
              </div>
              {documentJobs.map((job) => (
                <p key={job.id} className="text-caption text-ash">
                  {job.printerName} · {job.status} · {job.pagesPrinted}/{job.pagesTotal}
                  {job.errorMessage ? ` · ${job.errorMessage}` : ""}
                </p>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
