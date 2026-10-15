"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OrderTrackingData } from "../types/tracking";
import {
  fetchOrderTracking,
  isAwaitingShop,
  isTerminalStatus,
  mapTrackingToOrder,
  normalizeTrackingDocument,
} from "../data/tracking-repository";
import { TRACKING_COPY, TRACKING_TIMINGS } from "../data/tracking-constants";
import { useShopSession } from "../components/shop-session-provider";

/**
 * Live order tracking (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 11.1): signs in with the session's guest
 * token and listens to orderTracking/{orderId}, so status changes arrive without polling. Without a
 * token, or if the listener fails, it reads the order once and the Refresh button reads it again.
 */
export function useOrderTracking() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { routes, firebaseToken } = useShopSession();
  const orderIdParam = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderTrackingData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [now, setNow] = useState<number>(() => Date.now());

  const isMountedRef = useRef<boolean>(true);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // One read: the initial fallback, retries, and the Refresh button.
  const loadOnce = useCallback(async () => {
    try {
      const data = await fetchOrderTracking(orderIdParam);
      if (!isMountedRef.current) return;
      setOrder(data);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("Failed to load order tracking:", err);
      setError(TRACKING_COPY.fetchFailedDescription);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [orderIdParam]);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;
    let stop: (() => void) | undefined;

    const fallback = () => {
      if (!cancelled) {
        setIsLive(false);
        void loadOnce();
      }
    };

    if (!orderIdParam || !firebaseToken) {
      fallback();
    } else {
      void (async () => {
        try {
          const client = await import("../lib/firebase-client");
          if (!client.trackingListenerAvailable()) {
            throw new Error("Firebase is not configured for this build");
          }
          await client.signInGuest(firebaseToken);
          if (cancelled) return;
          stop = client.watchOrderTracking(
            orderIdParam,
            (data) => {
              if (cancelled) return;
              if (!data) {
                // No tracking copy (for example an order placed before live tracking): read once.
                fallback();
                return;
              }
              const mapped = mapTrackingToOrder(normalizeTrackingDocument(data));
              setOrder(mapped);
              setError(null);
              setIsLoading(false);
              setIsLive(true);
              if (isTerminalStatus(mapped.status)) {
                // Nothing more will change; stop listening.
                stop?.();
                stop = undefined;
                setIsLive(false);
              }
            },
            (err) => {
              console.warn("Live order tracking stopped; reading once instead:", err);
              fallback();
            },
          );
        } catch (err) {
          console.warn("Live order tracking unavailable; reading once instead:", err);
          fallback();
        }
      })();
    }

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      stop?.();
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, [firebaseToken, loadOnce, orderIdParam]);

  // A local clock for the "shop hasn't confirmed" notice; it never calls the server.
  useEffect(() => {
    if (order?.status !== "SUBMITTED") return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [order?.status]);

  // User-initiated refresh: one read.
  const refresh = useCallback(async () => {
    if (!order || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadOnce();
    } finally {
      if (isMountedRef.current) setIsRefreshing(false);
    }
  }, [isRefreshing, loadOnce, order]);

  const retryLoad = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await loadOnce();
  }, [loadOnce]);

  // Copy order reference to clipboard
  const copyOrderReference = useCallback(() => {
    if (!order) return;
    const textToCopy = order.displayReference;

    const showCopied = () => {
      if (!isMountedRef.current) return;
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) setCopied(false);
      }, TRACKING_TIMINGS.COPY_FEEDBACK_DURATION_MS);
    };

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(textToCopy).then(showCopied);
    } else {
      showCopied();
    }
  }, [order]);

  const startNewOrder = useCallback(() => {
    router.push(routes.home);
  }, [router, routes.home]);

  return {
    order,
    isLoading,
    isRefreshing,
    isLive,
    awaitingShop: order ? isAwaitingShop(order, now) : false,
    error,
    copied,
    copyOrderReference,
    refresh,
    startNewOrder,
    retryLoad,
  };
}
