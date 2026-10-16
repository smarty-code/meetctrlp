import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  billablePages,
  canMockConfirmPayment,
  canSubmitGuestDocuments,
  clientIpFromHeaders,
  guestStorageKey,
  isAbandonedUpload,
  isEncryptedPdf,
  isPageSelectionValid,
  isSessionExpired,
  mapShopStatusToCustomer,
  mimeFromFilename,
  mockPaymentsAllowed,
  normalizeMimeType,
  officeFormatMessage,
  parsePageSelection,
  sessionCookieOptions,
} from "./print-user.helpers.ts";

describe("print-user helpers", () => {
  it("reads the first forwarded IP", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" });
    assert.equal(clientIpFromHeaders(headers), "203.0.113.10");
  });

  it("trusts the proxy's client IP only with the matching secret", () => {
    const headers = new Headers({
      "x-forwarded-for": "34.1.2.3",
      "x-ctrlp-client-ip": "203.0.113.10",
      "x-ctrlp-proxy-secret": "proxy-secret-value",
    });
    assert.equal(clientIpFromHeaders(headers, "proxy-secret-value"), "203.0.113.10");
    assert.equal(clientIpFromHeaders(headers, "another-secret-value"), "34.1.2.3");
    assert.equal(clientIpFromHeaders(headers), "34.1.2.3");

    const unsigned = new Headers({ "x-forwarded-for": "34.1.2.3", "x-ctrlp-client-ip": "203.0.113.10" });
    assert.equal(clientIpFromHeaders(unsigned, "proxy-secret-value"), "34.1.2.3");
  });

  it("rejects office files and accepts printables", () => {
    assert.equal(
      officeFormatMessage("notes.docx"),
      "Word and PowerPoint files are not supported yet. Upload a PDF, JPEG, or PNG.",
    );
    assert.equal(officeFormatMessage("slides.pptx")?.includes("PowerPoint"), true);
    assert.equal(officeFormatMessage("resume.pdf"), null);
    assert.equal(mimeFromFilename("photo.JPEG"), "image/jpeg");
    assert.equal(normalizeMimeType("image/jpg", "scan.jpg"), "image/jpeg");
    assert.equal(normalizeMimeType("application/msword", "file.doc"), null);
  });

  it("builds guest storage keys", () => {
    assert.equal(
      guestStorageKey("shop-1", "guest-1", "doc-1", "application/pdf"),
      "uploads/shop-1/guest-1/doc-1.pdf",
    );
  });

  it("counts selected pages for quotes", () => {
    assert.deepEqual(parsePageSelection("1,3,5-8", 10), [1, 3, 5, 6, 7, 8]);
    assert.equal(isPageSelectionValid("1,3,5-8", 10), true);
    assert.equal(isPageSelectionValid("1-99", 10), false);
    assert.equal(billablePages(12, "all", ""), 12);
    assert.equal(billablePages(12, "selected", "1,3,5-8"), 6);
  });

  it("requires ready documents before submit", () => {
    assert.deepEqual(canSubmitGuestDocuments([]), { ok: false, status: 400, reason: "upload at least one document" });
    assert.deepEqual(canSubmitGuestDocuments([{ status: "READY" }, { status: "UPLOADING" }]), {
      ok: false,
      status: 409,
      reason: "DOCUMENTS_STILL_UPLOADING",
    });
    assert.equal(canSubmitGuestDocuments([{ status: "READY" }]).ok, true);
  });

  it("allows mock pay only for pending online orders", () => {
    assert.equal(
      canMockConfirmPayment({ printUserId: "g1", payment: { method: "CASH", status: "PENDING" } }).ok,
      false,
    );
    assert.equal(
      canMockConfirmPayment({ printUserId: "g1", payment: { method: "ONLINE", status: "PENDING" } }).ok,
      true,
    );
    assert.equal(
      canMockConfirmPayment({ printUserId: "g1", payment: { method: "ONLINE", status: "PAID" } }).ok,
      true,
    );
  });

  it("allows mock payments only when explicitly enabled", () => {
    assert.equal(mockPaymentsAllowed({}), false);
    assert.equal(mockPaymentsAllowed({ ALLOW_MOCK_PAYMENTS: "0" }), false);
    assert.equal(mockPaymentsAllowed({ ALLOW_MOCK_PAYMENTS: "true" }), false);
    assert.equal(mockPaymentsAllowed({ ALLOW_MOCK_PAYMENTS: "1" }), true);
  });

  it("maps shop availability for the customer UI", () => {
    assert.equal(mapShopStatusToCustomer("ACTIVE", true), "OPEN");
    assert.equal(mapShopStatusToCustomer("ACTIVE", false), "CLOSED");
    assert.equal(mapShopStatusToCustomer("SUSPENDED", true), "TEMPORARILY_UNAVAILABLE");
  });

  it("expires sessions after the stored timestamp", () => {
    assert.equal(isSessionExpired(new Date(Date.now() - 1000)), true);
    assert.equal(isSessionExpired(new Date(Date.now() + 60_000)), false);
    assert.equal(sessionCookieOptions(false).sameSite, "lax");
    assert.equal(sessionCookieOptions(true).sameSite, "none");
  });

  it("detects encrypted pdfs", () => {
    const bytes = Buffer.from("%PDF-1.4\n/Encrypt 3 0 R\n/Type /Page\n", "latin1");
    assert.equal(isEncryptedPdf(bytes), true);
    assert.equal(isEncryptedPdf(Buffer.from("%PDF-1.4\n/Type /Page\n", "latin1")), false);
  });

  it("frees cart slots held by failed or stale upload intents only", () => {
    const now = new Date("2026-10-14T10:00:00Z");
    const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
    assert.equal(isAbandonedUpload({ status: "FAILED", createdAt: minutesAgo(1) }, now), true);
    assert.equal(isAbandonedUpload({ status: "UPLOADING", createdAt: minutesAgo(1) }, now), false);
    assert.equal(isAbandonedUpload({ status: "UPLOADING", createdAt: minutesAgo(25) }, now), true);
    assert.equal(isAbandonedUpload({ status: "UPLOADING", createdAt: null }, now), true);
    assert.equal(isAbandonedUpload({ status: "READY", createdAt: minutesAgo(600) }, now), false);
  });
});
