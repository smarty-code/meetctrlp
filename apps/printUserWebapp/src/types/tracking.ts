import { PaymentMethodId, PaymentState } from "./payment";

export type OrderLifecycleStatus =
  | "SUBMITTED"
  | "ACCEPTED"
  | "PRINTING"
  | "READY"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED";

export type TimelineStepState = "completed" | "current" | "upcoming" | "failed";

export interface TimelineStepItem {
  id: string;
  title: string;
  description: string;
  state: TimelineStepState;
  timestamp?: string;
}

export interface CompactDocumentItem {
  id: string;
  name: string;
  pages: number;
  copies: number;
  colorMode: "bw" | "color";
  paperSize: string;
  linePrice?: number;
  previewUrl?: string;
  type?: string;
}

export interface DocumentSummary {
  totalDocuments: number;
  totalPages: number;
  totalCopies: number;
  items: CompactDocumentItem[];
}

export interface TrackingShopInfo {
  id: string;
  name: string;
  address: string;
  phone?: string;
  estimatedMinutes?: number;
  counterInstructions?: string;
  mapUrl?: string;
}

export interface OrderTrackingData {
  orderId: string;
  displayReference: string;
  status: OrderLifecycleStatus;
  paymentMethod: PaymentMethodId;
  paymentState: PaymentState;
  totalAmount: number;
  currency: string;
  shop: TrackingShopInfo;
  documentSummary: DocumentSummary;
  estimatedReadyTime?: string;
  submittedAt: string;
  updatedAt: string;
  timeline: TimelineStepItem[];
  collectionInstructions?: string;
  customerSafeFailureReason?: string;
}

export interface StatusPresentationConfig {
  label: string;
  headline: string;
  customerDescription: string;
  waitingHeadline?: string;
  waitingDescription?: string;
  badgeVariant: "default" | "success" | "warning" | "destructive" | "neutral";
  iconName:
    | "clock"
    | "check-circle"
    | "printer"
    | "package-check"
    | "alert-circle"
    | "x-circle";
  stepIndex: number;
  isTerminal: boolean;
}

