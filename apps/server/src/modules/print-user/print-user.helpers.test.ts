import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  billablePages,
  canMockConfirmPayment,
  canSubmitGuestDocuments,
  clientIpFromHeaders,
  guestStorageKey,
  isEncryptedPdf,
  isPageSelectionValid,
  isSessionExpired,
  mapShopStatusToCustomer,
  mimeFromFilename,
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
    assert.equal(canSubmitGuestDocuments([]).ok, false);
    assert.equal(canSubmitGuestDocuments([{ status: "UPLOADING" }]).ok, false);
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
});
