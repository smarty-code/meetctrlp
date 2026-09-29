"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { startShopSession, type GuestSessionDto, type PublicShop } from "../lib/cloud"
import { mapPublicShopToContext, shopRoutes } from "../lib/print-user-map"
import type { ShopContext } from "../types/upload"

const SHOP_STORAGE_KEY = "ctrlp-public-shop"

type ShopSessionValue = {
  slug: string
  shop: ShopContext
  publicShop: PublicShop
  session: GuestSessionDto
  routes: ReturnType<typeof shopRoutes>
}

const ShopSessionContext = createContext<ShopSessionValue | null>(null)

export function useShopSession() {
  const value = useContext(ShopSessionContext)
  if (!value) {
    throw new Error("useShopSession must be used under a shop URL")
  }
  return value
}

export function ShopSessionProvider({
  slug,
  children,
}: {
  slug: string
  children: ReactNode
}) {
  const [value, setValue] = useState<ShopSessionValue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    startShopSession(slug)
      .then(({ shop, session }) => {
        if (cancelled) return
        window.sessionStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(shop))
        setValue({
          slug: shop.slug,
          shop: mapPublicShopToContext(shop),
          publicShop: shop,
          session,
          routes: shopRoutes(shop.slug),
        })
      })
      .catch((cause) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : "This shop is not available.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center text-body font-bold text-midnight">
          Opening this print shop…
        </div>
      )
    }
    if (error || !value) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
          <h1 className="text-heading-sm font-bold text-midnight">Shop unavailable</h1>
          <p className="mt-2 max-w-md text-body text-ash">
            {error ?? "This shop link is invalid or the shop is not accepting orders."}
          </p>
        </div>
      )
    }
    return <ShopSessionContext.Provider value={value}>{children}</ShopSessionContext.Provider>
  }, [children, error, loading, value])

  return content
}

export function readStoredPublicShop(): PublicShop | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(SHOP_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PublicShop) : null
  } catch {
    return null
  }
}
