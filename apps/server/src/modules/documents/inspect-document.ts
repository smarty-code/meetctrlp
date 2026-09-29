import { createHash } from "node:crypto";

import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { isEncryptedPdf } from "@/src/modules/print-user/print-user.helpers";

export function inspectDocument(bytes: Buffer, mimeType: "application/pdf" | "image/jpeg" | "image/png") {
  if (mimeType === "image/jpeg") {
    if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new AuthServiceError(400, "file is not a readable JPEG");
    }
    return { pageCount: 1, fileSizeBytes: bytes.length, sha256Hash: createHash("sha256").update(bytes).digest("hex") };
  }
  if (mimeType === "image/png") {
    const png = "89504e470d0a1a0a";
    if (bytes.length < 8 || bytes.subarray(0, 8).toString("hex") !== png) {
      throw new AuthServiceError(400, "file is not a readable PNG");
    }
    return { pageCount: 1, fileSizeBytes: bytes.length, sha256Hash: createHash("sha256").update(bytes).digest("hex") };
  }
  if (bytes.length < 5 || bytes.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new AuthServiceError(400, "file is not a readable PDF");
  }
  if (isEncryptedPdf(bytes)) {
    throw new AuthServiceError(400, "password-protected PDFs are not supported");
  }

  const pageCount = bytes.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0;
  if (pageCount < 1) {
    throw new AuthServiceError(400, "PDF has no pages or is corrupted");
  }

  return {
    pageCount,
    fileSizeBytes: bytes.length,
    sha256Hash: createHash("sha256").update(bytes).digest("hex"),
  };
}
