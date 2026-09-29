import { FieldValue, getFirebaseFirestore } from "@ctrlp/firebase/firestore";
import type {
  PriceQuoteRequestInput,
  UpdateOrderAutomationRequestInput,
  UpdateShopCapabilitiesRequestInput,
  UpdateShopHoursRequestInput,
  UpdateShopPricingRequestInput,
} from "@ctrlp/schemas";
import type { AuthSessionUser } from "@ctrlp/types";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";

const SERVICE = "DOCUMENT_PRINT";
const TIME_ZONE = "Asia/Kolkata";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type BusinessHour = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

export type ShopPricing = {
  currency: "INR";
  unit: "PER_PAGE";
  bwA4PricePaise: number;
  colorA4PricePaise: number;
  colorA3PricePaise: number;
  updatedAt: string | null;
};

export type ShopCapabilities = {
  bwPrinting: true;
  colorPrinting: boolean;
  a4Printing: true;
  a3Printing: boolean;
};

export type OrderAutomation = {
  autoAcceptPaidOnline: boolean;
  autoDispatchAcceptedOrders: boolean;
  cashRequiresOperatorAcceptance: boolean;
};

export type ShopConfig = {
  service: typeof SERVICE;
  pricing: ShopPricing;
  capabilities: ShopCapabilities;
  orderAutomation: OrderAutomation;
  businessHours: BusinessHour[];
  openNow: boolean;
};

function shopRef(shopId: string) {
  return getFirebaseFirestore().doc(`shops/${shopId}`);
}

function integerOrZero(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function timestampToIso(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return typeof value === "string" ? value : null;
}

function parseHours(value: unknown): BusinessHour[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const hour = entry as Record<string, unknown>;
    if (
      typeof hour.dayOfWeek !== "number" ||
      typeof hour.opensAt !== "string" ||
      typeof hour.closesAt !== "string"
    ) {
      return [];
    }

    return [
      {
        dayOfWeek: hour.dayOfWeek,
        opensAt: hour.opensAt,
        closesAt: hour.closesAt,
        isClosed: hour.isClosed === true,
      },
    ];
  });
}

function readConfig(data: Record<string, unknown>): ShopConfig {
  const pricing =
    data.pricing && typeof data.pricing === "object"
      ? (data.pricing as Record<string, unknown>)
      : {};
  const capabilities =
    data.capabilities && typeof data.capabilities === "object"
      ? (data.capabilities as Record<string, unknown>)
      : {};
  const businessHours = parseHours(data.businessHours);
  const automation =
    data.orderAutomation && typeof data.orderAutomation === "object"
      ? (data.orderAutomation as Record<string, unknown>)
      : {};

  return {
    service: SERVICE,
    pricing: {
      currency: "INR",
      unit: "PER_PAGE",
      bwA4PricePaise: integerOrZero(pricing.bwA4PricePaise),
      colorA4PricePaise: integerOrZero(pricing.colorA4PricePaise),
      colorA3PricePaise: integerOrZero(pricing.colorA3PricePaise),
      updatedAt: timestampToIso(pricing.updatedAt),
    },
    capabilities: {
      bwPrinting: true,
      colorPrinting: capabilities.colorPrinting === true,
      a4Printing: true,
      a3Printing: capabilities.a3Printing === true,
    },
    orderAutomation: {
      autoAcceptPaidOnline: automation.autoAcceptPaidOnline !== false,
      autoDispatchAcceptedOrders: automation.autoDispatchAcceptedOrders !== false,
      cashRequiresOperatorAcceptance: automation.cashRequiresOperatorAcceptance !== false,
    },
    businessHours,
    openNow: isShopOpen(businessHours, new Date()),
  };
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function isShopOpen(hours: BusinessHour[], instant: Date) {
  if (hours.length === 0) {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const dayOfWeek = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  const day = hours.find((entry) => entry.dayOfWeek === dayOfWeek);

  if (!day || day.isClosed || dayOfWeek < 0) {
    return false;
  }

  const now = toMinutes(`${hour}:${minute}`);
  return now >= toMinutes(day.opensAt) && now < toMinutes(day.closesAt);
}

async function requireShopData(shopId: string) {
  const snapshot = await shopRef(shopId).get();

  if (!snapshot.exists) {
    throw new AuthServiceError(404, "shop not found");
  }

  return snapshot.data() as Record<string, unknown>;
}

export async function getShopConfig(user: AuthSessionUser) {
  return readConfig(await requireShopData(user.shopId));
}

export async function updateShopPricing(
  user: AuthSessionUser,
  rates: UpdateShopPricingRequestInput,
) {
  const reference = shopRef(user.shopId);

  await getFirebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (!snapshot.exists) {
      throw new AuthServiceError(404, "shop not found");
    }

    transaction.update(reference, {
      service: SERVICE,
      "pricing.currency": "INR",
      "pricing.unit": "PER_PAGE",
      "pricing.bwA4PricePaise": rates.bwA4PricePaise,
      "pricing.colorA4PricePaise": rates.colorA4PricePaise,
      "pricing.colorA3PricePaise": rates.colorA3PricePaise,
      "pricing.updatedAt": FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return getShopConfig(user);
}

export async function updateShopCapabilities(
  user: AuthSessionUser,
  input: UpdateShopCapabilitiesRequestInput,
) {
  const reference = shopRef(user.shopId);

  await getFirebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (!snapshot.exists) {
      throw new AuthServiceError(404, "shop not found");
    }

    transaction.update(reference, {
      "capabilities.bwPrinting": true,
      "capabilities.colorPrinting": input.colorPrinting,
      "capabilities.a4Printing": true,
      "capabilities.a3Printing": input.a3Printing,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return getShopConfig(user);
}

export async function updateOrderAutomation(
  user: AuthSessionUser,
  input: UpdateOrderAutomationRequestInput,
) {
  const reference = shopRef(user.shopId);
  await getFirebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new AuthServiceError(404, "shop not found");
    transaction.update(reference, {
      orderAutomation: input,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return getShopConfig(user);
}

export async function updateShopHours(
  user: AuthSessionUser,
  input: UpdateShopHoursRequestInput,
) {
  const reference = shopRef(user.shopId);
  const businessHours = [...input.businessHours].sort(
    (left, right) => left.dayOfWeek - right.dayOfWeek,
  );

  await getFirebaseFirestore().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (!snapshot.exists) {
      throw new AuthServiceError(404, "shop not found");
    }

    transaction.update(reference, {
      businessHours,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return getShopConfig(user);
}

export async function incrementShopStats(
  shopId: string,
  input: { totalOrdersToday?: number; grossRevenueTodayPaise?: number; cashInDrawerTodayPaise?: number },
) {
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (input.totalOrdersToday) {
    update["stats.totalOrdersToday"] = FieldValue.increment(input.totalOrdersToday);
  }
  if (input.grossRevenueTodayPaise) {
    update["stats.grossRevenueTodayPaise"] = FieldValue.increment(input.grossRevenueTodayPaise);
  }
  if (input.cashInDrawerTodayPaise) {
    update["stats.cashInDrawerTodayPaise"] = FieldValue.increment(input.cashInDrawerTodayPaise);
  }
  await shopRef(shopId).set(update, { merge: true });
}

export function quoteDocumentPrint(config: ShopConfig, input: PriceQuoteRequestInput) {
  if (input.paperSize === "A3" && input.colorMode === "BW") {
    throw new AuthServiceError(400, "A3 pricing is offered for color printing only");
  }

  if (input.colorMode === "COLOR" && !config.capabilities.colorPrinting) {
    throw new AuthServiceError(400, "this shop does not offer color printing");
  }

  if (input.paperSize === "A3" && !config.capabilities.a3Printing) {
    throw new AuthServiceError(400, "this shop does not offer A3 printing");
  }

  const unitPricePaise =
    input.paperSize === "A3"
      ? config.pricing.colorA3PricePaise
      : input.colorMode === "COLOR"
        ? config.pricing.colorA4PricePaise
        : config.pricing.bwA4PricePaise;

  if (unitPricePaise < 50) {
    throw new AuthServiceError(400, "save a page rate before pricing an order");
  }

  const totalPaise = input.billablePages * input.copies * unitPricePaise;

  if (!Number.isSafeInteger(totalPaise)) {
    throw new AuthServiceError(400, "price is too large");
  }

  return {
    service: SERVICE,
    currency: "INR" as const,
    colorMode: input.colorMode,
    paperSize: input.paperSize,
    billablePages: input.billablePages,
    copies: input.copies,
    unitPricePaise,
    totalPaise,
  };
}

export async function quoteShopDocument(user: AuthSessionUser, input: PriceQuoteRequestInput) {
  return quoteDocumentPrint(await getShopConfig(user), input);
}
