import type { SupportedMimeType } from "@/src/modules/print-user/print-user.helpers";

export type GuestDocumentStatus = "UPLOADING" | "READY" | "FAILED";

export type GuestDocumentConfig = {
  colorMode: "BW" | "COLOR";
  copies: number;
  paperSize: "A4" | "A3";
  pageSelection: string;
  billablePages: number;
  orientation: "PORTRAIT" | "LANDSCAPE";
};

export type GuestDocument = {
  id: string;
  originalFilename: string;
  mimeType: SupportedMimeType;
  fileSizeBytes: number;
  pageCount: number | null;
  sha256Hash: string | null;
  storageKey: string;
  status: GuestDocumentStatus;
  config: GuestDocumentConfig;
};

export type PrintUserSession = {
  id: string;
  shopId: string;
  shopSlug: string;
  ipAddress: string;
  documents: GuestDocument[];
  activeOrderId: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
};

export type PublicShopDto = {
  id: string;
  name: string;
  slug: string;
  status: "OPEN" | "CLOSED" | "TEMPORARILY_UNAVAILABLE";
  shopStatus: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  addressParts: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
  openNow: boolean;
  estimatedMinutes: number;
  startingPriceA4: number;
  capabilities: {
    bwPrinting: true;
    colorPrinting: boolean;
    a4Printing: true;
    a3Printing: boolean;
  };
  pricing: {
    currency: "INR";
    unit: "PER_PAGE";
    bwA4PricePaise: number;
    colorA4PricePaise: number;
    colorA3PricePaise: number;
  };
  businessHours: Array<{
    dayOfWeek: number;
    opensAt: string;
    closesAt: string;
    isClosed: boolean;
  }>;
  acceptsCash: boolean;
  acceptsOnline: boolean;
};
