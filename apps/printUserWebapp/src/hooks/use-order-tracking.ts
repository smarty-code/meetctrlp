"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OrderLifecycleStatus, OrderTrackingData } from "../types/tracking";
import {
  fetchOrderTracking,
  pollLatestOrderStatus,
  transitionOrderStatus,
} from "../data/tracking-repository";
import {
  TRACKING_COPY,
  TRACKING_ROUTES,
  TRACKING_TIMINGS,
} from "../data/tracking-constants";

export function useOrderTracking() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderTrackingData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initial Load
  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchOrderTracking(orderIdParam);
      if (!isMountedRef.current) return;
      setOrder(data);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error("Failed to load order tracking:", err);
      setError(TRACKING_COPY.fetchFailedDescription);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [orderIdParam]);

  useEffect(() => {
    isMountedRef.current = true;
    loadOrder();

    return () => {
      isMountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, [loadOrder]);

  // Periodic polling for status updates (stops on terminal states)
  useEffect(() => {
    if (!order) return;
    const isTerminal =
      order.status === "COMPLETED" ||
      order.status === "REJECTED" ||
      order.status === "CANCELLED" ||
      order.status === "FAILED";

    if (isTerminal) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(async () => {
      try {
        const updated = await pollLatestOrderStatus(order);
        if (isMountedRef.current && updated) {
          setOrder(updated);
        }
      } catch (err) {
        // Soft fail: preserve last known good state
        console.warn("Silent background status poll failed:", err);
      }
    }, TRACKING_TIMINGS.POLLING_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [order]);

  // User-initiated refresh
  const refresh = useCallback(async () => {
    if (!order || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const updated = await pollLatestOrderStatus(order);
      if (isMountedRef.current) {
        setOrder(updated);
      }
    } catch (err) {
      console.warn("Manual refresh failed:", err);
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [order, isRefreshing]);

  // Copy order reference to clipboard
  const copyOrderReference = useCallback(() => {
    if (!order) return;
    const textToCopy = order.displayReference;

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        if (!isMountedRef.current) return;
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) setCopied(false);
        }, TRACKING_TIMINGS.COPY_FEEDBACK_DURATION_MS);
      });
    } else {
      // Fallback
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) setCopied(false);
      }, TRACKING_TIMINGS.COPY_FEEDBACK_DURATION_MS);
    }
  }, [order]);

  // State Transition Simulator (for testing / demo purposes)
  const setStatus = useCallback(
    (newStatus: OrderLifecycleStatus) => {
      if (!order) return;
      const transitioned = transitionOrderStatus(order, newStatus);
      setOrder(transitioned);
    },
    [order],
  );

  const startNewOrder = useCallback(() => {
    router.push(TRACKING_ROUTES.HOME);
  }, [router]);

  return {
    order,
    isLoading,
    isRefreshing,
    error,
    copied,
    copyOrderReference,
    refresh,
    setStatus,
    startNewOrder,
    retryLoad: loadOrder,
  };
}
