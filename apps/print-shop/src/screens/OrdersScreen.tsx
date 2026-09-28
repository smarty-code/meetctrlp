import { useMemo, useState } from "react"
import { Badge } from "@ctrlp/ui/badge"
import { Button } from "@ctrlp/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ctrlp/ui/card"

import type { ShopOrder, ShopOrderStatus } from "../lib/protocol"

const tabs: Array<{ id: "all" | "new" | "active" | "ready" | "completed"; label: string; statuses?: ShopOrderStatus[] }> = [
  { id: "all", label: "All" },
  { id: "new", label: "New", statuses: ["SUBMITTED"] },
  { id: "active", label: "Active", statuses: ["SHOP_ACCEPTED", "PRINTING"] },
  { id: "ready", label: "Ready", statuses: ["READY"] },
  { id: "completed", label: "Completed", statuses: ["COMPLETED", "REJECTED", "CANCELLED"] },
]

export function OrdersScreen({
  orders,
  busy,
  onOpen,
  onAccept,
  onReject,
}: {
  orders: ShopOrder[]
  busy: boolean
  onOpen: (order: ShopOrder) => void
  onAccept: (order: ShopOrder) => void
  onReject: (order: ShopOrder) => void
}) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("new")
  const [search, setSearch] = useState("")
  const visible = useMemo(() => {
    const current = tabs.find((entry) => entry.id === tab)
    const query = search.trim().toLowerCase()
    return orders.filter((order) => {
      if (current?.statuses && !current.statuses.includes(order.status)) {
        return false
      }
      return !query || [order.orderNumber, order.customerPhone, ...order.documents.map((document) => document.originalFilename)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    })
  }, [orders, search, tab])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((entry) => (
          <Button
            key={entry.id}
            size="sm"
            variant={entry.id === tab ? "default" : "outline"}
            className="rounded-[12px]"
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </Button>
        ))}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search order or file"
          className="ml-auto h-9 rounded-[12px] border border-graphite px-3 text-body"
        />
      </div>
      {visible.length === 0 ? (
        <Card className="rounded-[12px]">
          <CardContent className="pt-6 text-ash">No orders in this view.</CardContent>
        </Card>
      ) : (
        visible.map((order) => (
          <Card key={order.id} className="rounded-[12px]">
            <CardHeader className="flex-row items-start justify-between gap-3">
              <button type="button" className="text-left" onClick={() => onOpen(order)}>
                <CardTitle>{order.orderNumber}</CardTitle>
                <CardDescription>
                  {order.documents.length} document{order.documents.length === 1 ? "" : "s"} · ₹
                  {(order.amounts.totalMinorUnits / 100).toFixed(2)}
                </CardDescription>
              </button>
              <Badge variant={order.status === "SUBMITTED" ? "default" : "outline"}>{order.status}</Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-caption text-ash">
                {order.documents.map((document) => document.originalFilename).join(", ") || "No documents"}
              </p>
              {order.status === "SUBMITTED" ? (
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-[12px]" disabled={busy} onClick={() => onAccept(order)}>
                    Accept
                  </Button>
                  <Button size="sm" variant="destructive" className="rounded-[12px]" disabled={busy} onClick={() => onReject(order)}>
                    Reject
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="rounded-[12px]" onClick={() => onOpen(order)}>
                  View details
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
