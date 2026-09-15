import {
  OrderLifecycleStatus,
  OrderTrackingData,
  TimelineStepItem,
  TimelineStepState,
} from "../types/tracking";
import { getSubmittedOrder } from "./payment-repository";
import {
  TRACKING_COPY,
  TRACKING_STORAGE_KEYS,
} from "./tracking-constants";
import { SubmittedOrder } from "../types/payment";

/**
 * Builds chronological timeline steps based on the current order status.
 */
export function buildTimelineSteps(
  status: OrderLifecycleStatus,
  submittedAt: string,
  updatedAt: string,
): TimelineStepItem[] {
  const steps: { id: string; title: string; desc: string }[] = [
    {
      id: "step-submitted",
      title: "Order received",
      desc: "Order verified and transmitted to shop",
    },
    {
      id: "step-accepted",
      title: "Shop accepted",
      desc: "Accepted by store operator into queue",
    },
    {
      id: "step-printing",
      title: "Printing",
      desc: "Documents are being printed",
    },
    {
      id: "step-ready",
      title: "Ready for collection",
      desc: "Prints packed and waiting at pickup counter",
    },
  ];

  const statusRank: Record<OrderLifecycleStatus, number> = {
    SUBMITTED: 0,
    ACCEPTED: 1,
    PRINTING: 2,
    READY: 3,
    COMPLETED: 4,
    REJECTED: 1,
    CANCELLED: 1,
    FAILED: 2,
  };

  const currentRank = statusRank[status];

  return steps.map((s, idx) => {
    let state: TimelineStepState = "upcoming";
    let timestamp: string | undefined;

    if (status === "REJECTED" && idx === 1) {
      state = "failed";
      return {
        ...s,
        title: "Order rejected",
        description: "Shop was unable to accept this order",
        state,
        timestamp: updatedAt,
      };
    }

    if (status === "CANCELLED" && idx === 1) {
      state = "failed";
      return {
        ...s,
        title: "Order cancelled",
        description: "Order processing was halted",
        state,
        timestamp: updatedAt,
      };
    }

    if (status === "FAILED" && idx === 2) {
      state = "failed";
      return {
        ...s,
        title: "Printing failed",
        description: "Printer error occurred during production",
        state,
        timestamp: updatedAt,
      };
    }

    // Special case for SUBMITTED (Screen 06):
    // Order received is completed, subsequent shop acceptance and printing are upcoming.
    if (status === "SUBMITTED") {
      if (idx === 0) {
        state = "completed";
        timestamp = submittedAt;
      } else {
        state = "upcoming";
      }
    } else if (status === "ACCEPTED") {
      if (idx === 0) {
        state = "completed";
        timestamp = submittedAt;
      } else if (idx === 1) {
        state = "current";
        timestamp = updatedAt;
      } else {
        state = "upcoming";
      }
    } else if (status === "PRINTING") {
      if (idx < 2) {
        state = "completed";
        timestamp = idx === 0 ? submittedAt : undefined;
      } else if (idx === 2) {
        state = "current";
        timestamp = updatedAt;
      } else {
        state = "upcoming";
      }
    } else if (status === "READY") {
      if (idx < 3) {
        state = "completed";
        timestamp = idx === 0 ? submittedAt : undefined;
      } else if (idx === 3) {
        state = "current";
        timestamp = updatedAt;
      } else {
        state = "upcoming";
      }
    } else if (status === "COMPLETED") {
      state = "completed";
      timestamp = idx === 0 ? submittedAt : idx === 3 ? updatedAt : undefined;
    } else {
      if (idx < currentRank) {
        state = "completed";
        timestamp = idx === 0 ? submittedAt : undefined;
      } else if (idx === currentRank) {
        state = "current";
        timestamp = updatedAt;
      } else {
        state = "upcoming";
      }
    }

    return {
      id: s.id,
      title: s.title,
      description: s.desc,
      state,
      timestamp,
    };
  });
}

/**
 * Creates OrderTrackingData from a SubmittedOrder
 */
function createFromSubmittedOrder(
  submitted: SubmittedOrder,
): OrderTrackingData {
  const lifecycleStatus: OrderLifecycleStatus =
    submitted.status === "READY_FOR_PICKUP"
      ? "READY"
      : submitted.status === "SHOP_ACCEPTED"
        ? "ACCEPTED"
        : submitted.status === "PRINTING"
          ? "PRINTING"
          : submitted.status === "COMPLETED"
            ? "COMPLETED"
            : submitted.status === "FAILED"
              ? "FAILED"
              : "SUBMITTED";

  const displayRef = submitted.orderId.startsWith("ORD-")
    ? submitted.orderId
    : `ORD-${submitted.orderId.toUpperCase()}`;

  const now = new Date();
  const estMins = submitted.shop.estimatedMinutes || 15;
  const readyDate = new Date(now.getTime() + estMins * 60000);
  const estReadyTimeStr = readyDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return {
    orderId: submitted.orderId,
    displayReference: displayRef,
    status: lifecycleStatus,
    paymentMethod: submitted.paymentMethod,
    paymentState: submitted.paymentState,
    totalAmount: submitted.totalAmount,
    currency: submitted.currency,
    shop: {
      id: submitted.shop.id,
      name: submitted.shop.name,
      address: submitted.shop.address,
      phone: "+91 98765 43210",
      estimatedMinutes: estMins,
      counterInstructions: TRACKING_COPY.defaultPickupInstructions,
      mapUrl: `https://maps.google.com/?q=${encodeURIComponent(submitted.shop.name + " " + submitted.shop.address)}`,
    },
    documentSummary: {
      totalDocuments: submitted.totalDocuments || 1,
      totalPages: 12,
      totalCopies: submitted.totalCopies || 1,
      items: [
        {
          id: "doc-1",
          name: "Project_Proposal_Final.pdf",
          pages: 12,
          copies: submitted.totalCopies || 1,
          colorMode: "bw",
          paperSize: "A4",
        },
      ],
    },
    estimatedReadyTime: `Today, ${estReadyTimeStr} (~${estMins} mins)`,
    submittedAt: submitted.submittedAt,
    updatedAt: new Date().toISOString(),
    timeline: buildTimelineSteps(
      lifecycleStatus,
      submitted.submittedAt,
      new Date().toISOString(),
    ),
    collectionInstructions: TRACKING_COPY.defaultPickupInstructions,
  };
}

/**
 * Creates a sensible fallback order if accessed directly without previous flow
 */
function createDemoOrder(orderIdParam?: string): OrderTrackingData {
  const submittedAt = new Date(Date.now() - 3 * 60000).toISOString();
  const nowIso = new Date().toISOString();
  const displayId = orderIdParam || "ORD-DEMO772";

  return {
    orderId: displayId,
    displayReference: displayId,
    status: "SUBMITTED",
    paymentMethod: "ONLINE",
    paymentState: "SUCCESS",
    totalAmount: 48,
    currency: "INR",
    shop: {
      id: "shop-campus-central",
      name: "Campus Print Hub",
      address: "Student Center, Ground Floor, North Campus, Delhi University",
      phone: "+91 98765 43210",
      estimatedMinutes: 12,
      counterInstructions: TRACKING_COPY.defaultPickupInstructions,
      mapUrl: "https://maps.google.com/?q=Campus+Print+Hub",
    },
    documentSummary: {
      totalDocuments: 2,
      totalPages: 16,
      totalCopies: 1,
      items: [
        {
          id: "doc-1",
          name: "Thesis_Abstract_v2.pdf",
          pages: 6,
          copies: 1,
          colorMode: "bw",
          paperSize: "A4",
        },
        {
          id: "doc-2",
          name: "Presentation_Slides.pdf",
          pages: 10,
          copies: 1,
          colorMode: "color",
          paperSize: "A4",
        },
      ],
    },
    estimatedReadyTime: "Today, ~12 mins",
    submittedAt,
    updatedAt: nowIso,
    timeline: buildTimelineSteps("SUBMITTED", submittedAt, nowIso),
    collectionInstructions: TRACKING_COPY.defaultPickupInstructions,
  };
}

/**
 * Retrieves cached tracking data from sessionStorage
 */
export function getCachedOrderTracking(): OrderTrackingData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      TRACKING_STORAGE_KEYS.ORDER_TRACKING_CACHE,
    );
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Saves tracking data to sessionStorage
 */
export function saveCachedOrderTracking(data: OrderTrackingData): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      TRACKING_STORAGE_KEYS.ORDER_TRACKING_CACHE,
      JSON.stringify(data),
    );
  } catch (e) {
    console.warn("Failed to persist order tracking data:", e);
  }
}

/**
 * Loads order tracking data, honoring session cache, submitted order, or fallback
 */
export async function fetchOrderTracking(
  orderIdParam?: string | null,
): Promise<OrderTrackingData> {
  // Simulated small network roundtrip
  await new Promise((resolve) => setTimeout(resolve, 350));

  const cached = getCachedOrderTracking();
  if (cached && (!orderIdParam || cached.orderId === orderIdParam)) {
    return cached;
  }

  const submitted = getSubmittedOrder();
  if (submitted && (!orderIdParam || submitted.orderId === orderIdParam)) {
    const created = createFromSubmittedOrder(submitted);
    saveCachedOrderTracking(created);
    return created;
  }

  const demo = createDemoOrder(orderIdParam || undefined);
  saveCachedOrderTracking(demo);
  return demo;
}

/**
 * Polls backend for order status. Protects against backward state regression.
 */
export async function pollLatestOrderStatus(
  current: OrderTrackingData,
): Promise<OrderTrackingData> {
  // Simulate network request
  await new Promise((resolve) => setTimeout(resolve, 400));

  // If already at terminal state, keep it
  if (
    current.status === "COMPLETED" ||
    current.status === "REJECTED" ||
    current.status === "CANCELLED" ||
    current.status === "FAILED"
  ) {
    return current;
  }

  return current;
}

/**
 * Manually advances or transitions order status for testing / simulator
 */
export function transitionOrderStatus(
  current: OrderTrackingData,
  nextStatus: OrderLifecycleStatus,
): OrderTrackingData {
  const updatedAt = new Date().toISOString();
  const updated: OrderTrackingData = {
    ...current,
    status: nextStatus,
    updatedAt,
    timeline: buildTimelineSteps(nextStatus, current.submittedAt, updatedAt),
  };
  saveCachedOrderTracking(updated);
  return updated;
}
