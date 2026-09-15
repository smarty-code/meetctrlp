import {
  CompactDocumentItem,
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
import { STORAGE_KEYS } from "./review-constants";

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
 * Resolves the real list of configured documents from SubmittedOrder or session storage
 */
export function getRealDocumentsFromSession(
  submitted?: SubmittedOrder | null,
): CompactDocumentItem[] {
  // 1. Direct from submitted order if present
  if (
    submitted?.documents &&
    Array.isArray(submitted.documents) &&
    submitted.documents.length > 0
  ) {
    return submitted.documents.map((doc: any, idx: number) => {
      const effectivePages =
        doc.configuration?.pageSelection?.mode === "selected" &&
        Array.isArray(doc.configuration?.pageSelection?.pages) &&
        doc.configuration.pageSelection.pages.length > 0
          ? doc.configuration.pageSelection.pages.length
          : Math.max(1, doc.pageCount || 1);
      const copies = doc.configuration?.copies || 1;
      const colorMode = (doc.configuration?.colorMode || "bw") as
        | "bw"
        | "color";
      const paperSize = doc.configuration?.paperSize || "A4";
      const pricingItem = submitted.pricingItems?.find(
        (p: any) => p.documentId === doc.id,
      );
      const linePrice =
        pricingItem?.totalAmount ??
        copies * effectivePages * (colorMode === "color" ? 10 : 3);

      return {
        id: doc.id || `doc-${idx + 1}`,
        name: doc.name || `Document ${idx + 1}.pdf`,
        pages: effectivePages,
        copies,
        colorMode,
        paperSize,
        linePrice,
        previewUrl: doc.previewUrl,
        type: doc.type,
      };
    });
  }

  if (typeof window === "undefined") return [];

  try {
    // 2. Check STORAGE_KEYS.ORDER_DRAFT
    const storedDraft = window.sessionStorage.getItem(STORAGE_KEYS.ORDER_DRAFT);
    if (storedDraft) {
      const parsedDraft = JSON.parse(storedDraft);
      if (
        Array.isArray(parsedDraft.documents) &&
        parsedDraft.documents.length > 0
      ) {
        return parsedDraft.documents.map((doc: any, idx: number) => {
          const effectivePages =
            doc.configuration?.pageSelection?.mode === "selected" &&
            Array.isArray(doc.configuration?.pageSelection?.pages) &&
            doc.configuration.pageSelection.pages.length > 0
              ? doc.configuration.pageSelection.pages.length
              : Math.max(1, doc.pageCount || 1);
          const copies = doc.configuration?.copies || 1;
          const colorMode = (doc.configuration?.colorMode || "bw") as
            | "bw"
            | "color";
          const paperSize = doc.configuration?.paperSize || "A4";
          const pricingItem = parsedDraft.pricing?.items?.find(
            (p: any) => p.documentId === doc.id,
          );
          const linePrice =
            pricingItem?.totalAmount ??
            copies * effectivePages * (colorMode === "color" ? 10 : 3);

          return {
            id: doc.id || `doc-${idx + 1}`,
            name: doc.name || `Document ${idx + 1}.pdf`,
            pages: effectivePages,
            copies,
            colorMode,
            paperSize,
            linePrice,
            previewUrl: doc.previewUrl,
            type: doc.type,
          };
        });
      }
    }

    // 3. Check STORAGE_KEYS.CONFIGURED_DOCUMENTS
    const storedConfig = window.sessionStorage.getItem(
      STORAGE_KEYS.CONFIGURED_DOCUMENTS,
    );
    if (storedConfig) {
      const parsedConfig = JSON.parse(storedConfig);
      if (Array.isArray(parsedConfig) && parsedConfig.length > 0) {
        return parsedConfig.map((doc: any, idx: number) => {
          const effectivePages =
            doc.configuration?.pageSelection?.mode === "selected" &&
            Array.isArray(doc.configuration?.pageSelection?.pages) &&
            doc.configuration.pageSelection.pages.length > 0
              ? doc.configuration.pageSelection.pages.length
              : Math.max(1, doc.pageCount || 1);
          const copies = doc.configuration?.copies || 1;
          const colorMode = (doc.configuration?.colorMode || "bw") as
            | "bw"
            | "color";
          const paperSize = doc.configuration?.paperSize || "A4";
          const linePrice =
            copies * effectivePages * (colorMode === "color" ? 10 : 3);

          return {
            id: doc.id || `doc-${idx + 1}`,
            name: doc.name || `Document ${idx + 1}.pdf`,
            pages: effectivePages,
            copies,
            colorMode,
            paperSize,
            linePrice,
            previewUrl: doc.previewUrl,
            type: doc.type,
          };
        });
      }
    }

    // 4. Check STORAGE_KEYS.UPLOADED_FILES
    const storedUploads = window.sessionStorage.getItem(
      STORAGE_KEYS.UPLOADED_FILES,
    );
    if (storedUploads) {
      const parsedUploads = JSON.parse(storedUploads);
      if (Array.isArray(parsedUploads) && parsedUploads.length > 0) {
        return parsedUploads.map((file: any, idx: number) => {
          const pages = file.pageCount || 1;
          return {
            id: file.id || `doc-${idx + 1}`,
            name: file.name || `Document ${idx + 1}.pdf`,
            pages,
            copies: 1,
            colorMode: "bw" as const,
            paperSize: "A4",
            linePrice: pages * 3,
            previewUrl: file.previewUrl,
            type: file.type,
          };
        });
      }
    }

  } catch (e) {
    console.warn(
      "Failed reading real documents from session storage for tracking:",
      e,
    );
  }

  return [];
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

  const realItems = getRealDocumentsFromSession(submitted);
  const items =
    realItems.length > 0
      ? realItems
      : [
          {
            id: "doc-1",
            name: "Document.pdf",
            pages: 1,
            copies: submitted.totalCopies || 1,
            colorMode: "bw" as const,
            paperSize: "A4",
            linePrice: submitted.totalAmount,
          },
        ];

  const totalDocs = items.length;
  const totalCopies = items.reduce((sum, d) => sum + d.copies, 0);
  const totalPages = items.reduce((sum, d) => sum + d.pages * d.copies, 0);

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
      phone: submitted.shop.phone || "+91 98765 43210",
      estimatedMinutes: estMins,
      counterInstructions: TRACKING_COPY.defaultPickupInstructions,
      mapUrl:
        submitted.shop.mapUrl ||
        `https://maps.google.com/?q=${encodeURIComponent(submitted.shop.name + " " + submitted.shop.address)}`,
    },
    documentSummary: {
      totalDocuments: totalDocs,
      totalPages,
      totalCopies,
      items,
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
  const realItems = getRealDocumentsFromSession(null);

  const items =
    realItems.length > 0
      ? realItems
      : [
          {
            id: "doc-1",
            name: "Thesis_Abstract_v2.pdf",
            pages: 6,
            copies: 1,
            colorMode: "bw" as const,
            paperSize: "A4",
            linePrice: 18,
          },
          {
            id: "doc-2",
            name: "Presentation_Slides.pdf",
            pages: 10,
            copies: 1,
            colorMode: "color" as const,
            paperSize: "A4",
            linePrice: 30,
          },
        ];

  const totalAmount = items.reduce(
    (sum, it) =>
      sum +
      (it.linePrice ??
        it.copies * it.pages * (it.colorMode === "color" ? 10 : 3)),
    0,
  );
  const totalCopies = items.reduce((sum, d) => sum + d.copies, 0);
  const totalPages = items.reduce((sum, d) => sum + d.pages * d.copies, 0);

  return {
    orderId: displayId,
    displayReference: displayId,
    status: "SUBMITTED",
    paymentMethod: "ONLINE",
    paymentState: "SUCCESS",
    totalAmount: totalAmount || 48,
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
      totalDocuments: items.length,
      totalPages,
      totalCopies,
      items,
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

  const submitted = getSubmittedOrder();
  const cached = getCachedOrderTracking();

  // If cached data exists, verify that its items array is not a stale hardcoded fallback
  if (cached && (!orderIdParam || cached.orderId === orderIdParam)) {
    const realItems = getRealDocumentsFromSession(submitted);
    const hasDummyDoc = cached.documentSummary.items.some(
      (it) => it.id === "doc-1" && it.name === "Project_Proposal_Final.pdf",
    );
    const hasMismatchedCount =
      realItems.length > 0 &&
      cached.documentSummary.items.length !== realItems.length;

    if (realItems.length > 0 && (hasDummyDoc || hasMismatchedCount)) {
      const totalDocs = realItems.length;
      const totalCopies = realItems.reduce((sum, d) => sum + d.copies, 0);
      const totalPages = realItems.reduce(
        (sum, d) => sum + d.pages * d.copies,
        0,
      );
      const updatedTotal = realItems.reduce(
        (sum, it) =>
          sum +
          (it.linePrice ??
            it.copies * it.pages * (it.colorMode === "color" ? 10 : 3)),
        0,
      );

      const refreshed: OrderTrackingData = {
        ...cached,
        totalAmount: updatedTotal || cached.totalAmount,
        documentSummary: {
          totalDocuments: totalDocs,
          totalPages,
          totalCopies,
          items: realItems,
        },
      };
      saveCachedOrderTracking(refreshed);
      return refreshed;
    }

    return cached;
  }

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
