import { useMemo, useState } from "react"
import { Badge } from "@ctrlp/ui/badge"
import { Button } from "@ctrlp/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ctrlp/ui/card"
import { Input } from "@ctrlp/ui/input"

import { filterOrders } from "../lib/dashboard"
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
  const [date, setDate] = useState("")
  const [payment, setPayment] = useState<"all" | "CASH" | "ONLINE" | "PENDING" | "PAID">("all")
  const visible = useMemo(() => {
    const current = tabs.find((entry) => entry.id === tab)
    return filterOrders(orders, { statuses: current?.statuses, search, date, payment })
  }, [date, orders, payment, search, tab])

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
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search order or file"
          className="ml-auto h-9 max-w-56 rounded-[12px]"
        />
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-9 w-40 rounded-[12px]" />
        <select
          value={payment}
          onChange={(event) => setPayment(event.target.value as typeof payment)}
          className="h-9 rounded-[12px] border border-graphite bg-paper px-3 text-body"
        >
          <option value="all">All payments</option>
          <option value="CASH">Cash</option>
          <option value="ONLINE">Online</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
        </select>
      </div>
      {visible.length === 0 ? (
        <Card className="rounded-[12px]">
          <CardContent className="pt-6 text-ash">No orders in this view.</CardContent>
        </Card>
      ) : (
        visible.map((order) => {
          const pages = order.documents.reduce((sum, document) => sum + document.pageCount * document.copies, 0)
          return (
            <Card key={order.id} className="rounded-[12px]">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <button type="button" className="text-left" onClick={() => onOpen(order)}>
                  <CardTitle>{order.orderNumber}</CardTitle>
                  <CardDescription>
                    {pages} pages · {order.documents.length} document{order.documents.length === 1 ? "" : "s"} · ₹
                    {(order.amounts.totalMinorUnits / 100).toFixed(2)} · {order.createdAt ? new Date(order.createdAt).toLocaleString() : "No time"}
                  </CardDescription>
                </button>
                <Badge variant={order.status === "SUBMITTED" ? "default" : "outline"}>{order.status}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-caption text-ash">
                  {order.payment.method} · {order.payment.status} ·{" "}
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
          )
        })
      )}
    </div>
  )
}
