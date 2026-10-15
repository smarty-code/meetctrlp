import { useEffect, useMemo, useState } from "react"
import { Badge } from "@ctrlp/ui/badge"
import { Button } from "@ctrlp/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ctrlp/ui/card"
import { Input } from "@ctrlp/ui/input"

import type { OrderPage } from "../lib/cloud"
import { filterOrders } from "../lib/dashboard"
import type { ShopOrder, ShopOrderStatus } from "../lib/protocol"

type TabId = "all" | "new" | "active" | "ready" | "completed"

/** New, Active and Ready come from the live board. Completed and All are paged from the server. */
const tabs: Array<{ id: TabId; label: string; statuses?: ShopOrderStatus[]; live: boolean }> = [
  { id: "all", label: "All", live: false },
  { id: "new", label: "New", statuses: ["SUBMITTED"], live: true },
  { id: "active", label: "Active", statuses: ["SHOP_ACCEPTED", "PRINTING"], live: true },
  { id: "ready", label: "Ready", statuses: ["READY"], live: true },
  { id: "completed", label: "Completed", statuses: ["COMPLETED", "REJECTED", "CANCELLED"], live: false },
]

type PaymentFilter = "all" | "CASH" | "ONLINE" | "PENDING" | "PAID"

/** Searches shorter than this filter what's on screen; longer ones search every order on the server. */
const SERVER_SEARCH_MIN = 3

export function OrdersScreen({
  orders,
  busy,
  onOpen,
  onAccept,
  onReject,
  loadHistory,
  searchOrders,
}: {
  orders: ShopOrder[]
  busy: boolean
  onOpen: (order: ShopOrder) => void
  onAccept: (order: ShopOrder) => void
  onReject: (order: ShopOrder) => void
  loadHistory: (input: { statuses?: ShopOrderStatus[]; from?: string; to?: string; cursor?: string | null }) => Promise<OrderPage>
  searchOrders: (q: string, cursor?: string | null) => Promise<OrderPage>
}) {
  const [tab, setTab] = useState<TabId>("new")
  const [search, setSearch] = useState("")
  const [date, setDate] = useState("")
  const [payment, setPayment] = useState<PaymentFilter>("all")
  const [remote, setRemote] = useState<{ orders: ShopOrder[]; nextCursor: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const current = tabs.find((entry) => entry.id === tab)!
  const query = search.trim()
  const serverSearch = query.length >= SERVER_SEARCH_MIN
  const fromServer = serverSearch || !current.live || date !== ""

  async function fetchPage(cursor: string | null) {
    return serverSearch
      ? searchOrders(query, cursor)
      : loadHistory({ statuses: current.statuses, from: date || undefined, to: date || undefined, cursor })
  }

  useEffect(() => {
    if (!fromServer) {
      setRemote(null)
      setLoadError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    // Debounce typing, so a search runs once the operator pauses.
    const timer = window.setTimeout(() => {
      void fetchPage(null)
        .then((page) => {
          if (!cancelled) setRemote(page)
        })
        .catch((err: unknown) => {
          if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, serverSearch ? 300 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [fromServer, serverSearch, query, tab, date])

  async function loadMore() {
    if (!remote?.nextCursor) return
    setLoading(true)
    try {
      const page = await fetchPage(remote.nextCursor)
      setRemote({ orders: [...remote.orders, ...page.orders], nextCursor: page.nextCursor })
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const visible = useMemo(() => {
    if (fromServer) {
      // The server already applied status, date and search; payment filters the loaded page.
      return filterOrders(remote?.orders ?? [], { payment })
    }
    return filterOrders(orders, { statuses: current.statuses, search: query, payment })
  }, [current.statuses, fromServer, orders, payment, query, remote])

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
          placeholder="Order no., pickup code, phone or file"
          className="ml-auto h-9 max-w-64 rounded-[12px]"
        />
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-9 w-40 rounded-[12px]" />
        <select
          value={payment}
          onChange={(event) => setPayment(event.target.value as PaymentFilter)}
          className="h-9 rounded-[12px] border border-graphite bg-paper px-3 text-body"
        >
          <option value="all">All payments</option>
          <option value="CASH">Cash</option>
          <option value="ONLINE">Online</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
        </select>
      </div>
      {fromServer ? (
        <p className="text-caption text-ash">
          {serverSearch
            ? `Search results for "${query}" across all orders.`
            : date
              ? `Orders placed on ${date}.`
              : "Older orders, newest first."}
        </p>
      ) : null}
      {loadError ? (
        <Card className="rounded-[12px] border-destructive">
          <CardContent className="pt-6 text-destructive">{loadError}</CardContent>
        </Card>
      ) : null}
      {visible.length === 0 ? (
        <Card className="rounded-[12px]">
          <CardContent className="pt-6 text-ash">{loading ? "Loading orders…" : "No orders in this view."}</CardContent>
        </Card>
      ) : (
        visible.map((order) => <OrderCard key={order.id} order={order} busy={busy} onOpen={onOpen} onAccept={onAccept} onReject={onReject} />)
      )}
      {fromServer && remote?.nextCursor ? (
        <Button variant="outline" className="w-full rounded-[12px]" disabled={loading} onClick={() => void loadMore()}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      ) : null}
    </div>
  )
}

function OrderCard({
  order,
  busy,
  onOpen,
  onAccept,
  onReject,
}: {
  order: ShopOrder
  busy: boolean
  onOpen: (order: ShopOrder) => void
  onAccept: (order: ShopOrder) => void
  onReject: (order: ShopOrder) => void
}) {
  const pages = order.documents.reduce((sum, document) => sum + document.pageCount * document.copies, 0)
  return (
    <Card className="rounded-[12px]">
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
}
