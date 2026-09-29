export const PRINT_USER_COOKIE = "ctrlp_print_user";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const MAX_GUEST_FILES = 10;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const PRESIGN_TTL_SECONDS = 900;

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

const OFFICE_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx"]);

export function printUserOrigin() {
  return (process.env.PRINT_USER_ORIGIN ?? "http://localhost:3002").replace(/\/$/, "");
}

export function shopCustomerUrl(slug: string) {
  return `${printUserOrigin()}/s/${encodeURIComponent(slug)}`;
}

export function clientIpFromHeaders(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

export function filenameExtension(filename: string) {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

export function officeFormatMessage(filename: string) {
  const extension = filenameExtension(filename);
  if (!OFFICE_EXTENSIONS.has(extension)) {
    return null;
  }

  return "Word and PowerPoint files are not supported yet. Upload a PDF, JPEG, or PNG.";
}

export function mimeFromFilename(filename: string): SupportedMimeType | null {
  const extension = filenameExtension(filename);
  if (extension === "pdf") {
    return "application/pdf";
  }
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  if (extension === "png") {
    return "image/png";
  }
  return null;
}

export function normalizeMimeType(mimeType: string, filename: string): SupportedMimeType | null {
  const lowered = mimeType.trim().toLowerCase();
  if (lowered === "application/pdf" || lowered === "image/jpeg" || lowered === "image/png") {
    return lowered;
  }
  if (lowered === "image/jpg") {
    return "image/jpeg";
  }
  return mimeFromFilename(filename);
}

export function objectExtension(mimeType: SupportedMimeType) {
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType === "image/png") {
    return "png";
  }
  return "jpg";
}

export function guestStorageKey(
  shopId: string,
  printUserId: string,
  docId: string,
  mimeType: SupportedMimeType,
) {
  return `uploads/${shopId}/${printUserId}/${docId}.${objectExtension(mimeType)}`;
}

export function parsePageSelection(expression: string, pageCount: number): number[] {
  const pages = new Set<number>();

  for (const token of expression.split(",")) {
    const value = token.trim();
    if (!value) {
      continue;
    }

    if (/^\d+$/.test(value)) {
      const page = Number(value);
      if (page >= 1 && page <= pageCount) {
        pages.add(page);
      }
      continue;
    }

    const range = value.match(/^(\d+)-(\d+)$/);
    if (!range) {
      continue;
    }
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start < 1 || end > pageCount || start > end) {
      continue;
    }
    for (let page = start; page <= end; page += 1) {
      pages.add(page);
    }
  }

  return [...pages].sort((left, right) => left - right);
}

export function isPageSelectionValid(expression: string, pageCount: number) {
  if (!expression.trim()) {
    return false;
  }
  const pages = parsePageSelection(expression, pageCount);
  const tokens = expression
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  return pages.length > 0 && tokens.every((token) => /^\d+$/.test(token) || /^\d+-\d+$/.test(token));
}

export function billablePages(pageCount: number, mode: "all" | "selected", expression: string) {
  if (mode === "all") {
    return Math.max(1, pageCount);
  }
  return parsePageSelection(expression, pageCount).length;
}

export function pageSelectionValue(mode: "all" | "selected", expression: string, pages: number[]) {
  if (mode === "all") {
    return "all";
  }
  return expression.trim() || pages.join(",");
}

export function isSessionExpired(expiresAt: Date | string | null | undefined, now = new Date()) {
  if (!expiresAt) {
    return true;
  }
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

export function sessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    secure: isProduction,
  };
}

export function canSubmitGuestDocuments(
  documents: Array<{ status: string }>,
): { ok: true } | { ok: false; reason: string } {
  if (documents.length < 1) {
    return { ok: false, reason: "upload at least one document" };
  }
  if (documents.some((document) => document.status !== "READY")) {
    return { ok: false, reason: "every document must finish uploading first" };
  }
  return { ok: true };
}

export function canMockConfirmPayment(order: {
  printUserId: string;
  payment: { method: string; status: string };
}): { ok: true } | { ok: false; reason: string } {
  if (order.payment.method !== "ONLINE") {
    return { ok: false, reason: "ORDER_NOT_ONLINE" };
  }
  if (order.payment.status === "PAID") {
    return { ok: true };
  }
  if (order.payment.status !== "PENDING") {
    return { ok: false, reason: "PAYMENT_NOT_PENDING" };
  }
  return { ok: true };
}

export function mapShopStatusToCustomer(
  shopStatus: string,
  openNow: boolean,
): "OPEN" | "CLOSED" | "TEMPORARILY_UNAVAILABLE" {
  if (shopStatus === "ACTIVE") {
    return openNow ? "OPEN" : "CLOSED";
  }
  return "TEMPORARILY_UNAVAILABLE";
}

export function isShopAcceptingOrders(shopStatus: string) {
  return shopStatus === "ACTIVE";
}

export function isEncryptedPdf(bytes: Buffer) {
  return bytes.toString("latin1").includes("/Encrypt");
}
