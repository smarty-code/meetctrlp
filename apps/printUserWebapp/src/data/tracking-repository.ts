import { OrderLifecycleStatus, OrderTrackingData, TimelineStepItem, TimelineStepState } from "../types/tracking";
import { fetchOrderTracking as fetchOrderTrackingDto, type OrderTrackingDto } from "../lib/cloud";
import { mapPublicShopToContext, paiseToRupees } from "../lib/print-user-map";
import { readStoredPublicShop } from "../components/shop-session-provider";
import { TRACKING_TIMINGS } from "./tracking-constants";

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

function mapServerStatus(status: string): OrderLifecycleStatus {
  if (status === "SHOP_ACCEPTED") return "ACCEPTED";
  if (
    status === "SUBMITTED" ||
    status === "PRINTING" ||
    status === "READY" ||
    status === "COMPLETED" ||
    status === "REJECTED" ||
    status === "CANCELLED"
  ) {
    return status;
  }
  return "SUBMITTED";
}

export function isTerminalStatus(status: OrderLifecycleStatus) {
  return status === "COMPLETED" || status === "REJECTED" || status === "CANCELLED";
}

/** Firestore Timestamps (listener) or ISO strings (fetch) as ISO strings. */
function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/** Turns a raw orderTracking document from the listener into the same shape the fetch returns. */
export function normalizeTrackingDocument(data: Record<string, unknown>): OrderTrackingDto {
  const times = (data.times ?? {}) as Record<string, unknown>;
  return {
    ...(data as unknown as OrderTrackingDto),
    times: {
      submittedAt: toIso(times.submittedAt),
      paidAt: toIso(times.paidAt),
      acceptedAt: toIso(times.acceptedAt),
      printingAt: toIso(times.printingAt),
      readyAt: toIso(times.readyAt),
      completedAt: toIso(times.completedAt),
      rejectedAt: toIso(times.rejectedAt),
      cancelledAt: toIso(times.cancelledAt),
    },
    updatedAt: toIso(data.updatedAt),
  };
}

export function mapTrackingToOrder(tracking: OrderTrackingDto): OrderTrackingData {
  const shopRecord = readStoredPublicShop();
  const shop = shopRecord
    ? mapPublicShopToContext(shopRecord)
    : {
        id: tracking.shopId,
        name: "Print shop",
        address: "Pickup at the shop counter",
        status: "OPEN" as const,
        estimatedMinutes: 10,
        startingPriceA4: 3,
      };
  const status = mapServerStatus(tracking.status);
  const submittedAt = tracking.times.submittedAt ?? new Date().toISOString();
  const updatedAt = tracking.updatedAt ?? submittedAt;
  const items = tracking.items.map((item, index) => ({
    id: `${tracking.orderId}-${index}`,
    name: item.name,
    pages: item.billablePages || item.pageCount,
    copies: item.copies,
    colorMode: item.colorMode === "COLOR" ? ("color" as const) : ("bw" as const),
    paperSize: item.paperSize,
    linePrice: paiseToRupees(item.totalPaise),
    type: item.mimeType ?? undefined,
  }));

  return {
    orderId: tracking.orderId,
    displayReference: tracking.orderNumber || tracking.pickupCode || tracking.orderId,
    status,
    paymentMethod: tracking.payment.method,
    paymentState:
      tracking.payment.method === "CASH" && tracking.payment.status !== "PAID"
        ? "CASH_PENDING"
        : tracking.payment.status === "PAID"
          ? "SUCCESS"
          : "PENDING",
    totalAmount: paiseToRupees(tracking.totalPaise),
    currency: "INR",
    shop: {
      id: shop.id,
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      estimatedMinutes: shop.estimatedMinutes,
      mapUrl: shop.mapUrl,
      counterInstructions: `Pickup code ${tracking.pickupCode}`,
    },
    documentSummary: {
      totalDocuments: items.length,
      totalPages: items.reduce((sum, item) => sum + item.pages * item.copies, 0),
      totalCopies: items.reduce((sum, item) => sum + item.copies, 0),
      items,
    },
    submittedAt,
    paidAt: tracking.times.paidAt ?? undefined,
    updatedAt,
    timeline: buildTimelineSteps(status, submittedAt, updatedAt),
    collectionInstructions: `Show pickup code ${tracking.pickupCode} at the counter.`,
    customerSafeFailureReason: tracking.rejectionReason ?? undefined,
  };
}

/** One read of the order (the fallback, and the Refresh button). */
export async function fetchOrderTracking(orderId?: string | null): Promise<OrderTrackingData> {
  if (!orderId) {
    throw new Error("missing order id");
  }
  return mapTrackingToOrder(await fetchOrderTrackingDto(orderId));
}

/**
 * True when the order has waited in SUBMITTED for 10 minutes since it was paid (or placed): the
 * shop's PC may be off. Shown as "The shop hasn't confirmed your order yet" (design doc 5.5).
 */
export function isAwaitingShop(order: OrderTrackingData, now = Date.now()) {
  if (order.status !== "SUBMITTED") return false;
  const since = Date.parse(order.paidAt ?? order.submittedAt);
  return Number.isFinite(since) && now - since >= TRACKING_TIMINGS.NOT_CONFIRMED_AFTER_MS;
}
