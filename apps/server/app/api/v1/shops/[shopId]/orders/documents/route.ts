import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { createPdfOrder } from "@/src/modules/documents/document.service";
import { runShopOrder } from "@/src/modules/orders/order-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    const form = await request.formData();
    const colorMode = form.get("colorMode") === "COLOR" ? "COLOR" : "BW";
    const paperSize = form.get("paperSize") === "A3" ? "A3" : "A4";
    const paymentMethod = form.get("paymentMethod") === "ONLINE" ? "ONLINE" : "CASH";
    const copies = Number(form.get("copies") ?? "1");
    if (!Number.isInteger(copies) || copies < 1 || copies > 999) {
      throw new AuthServiceError(400, "copies must be from 1 to 999");
    }

    const files = form
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    if (files.length < 1 || files.length > 10) {
      throw new AuthServiceError(400, "upload between 1 and 10 PDF files");
    }

    const parsed: Array<{
      filename: string;
      bytes: Buffer;
      mimeType: "application/pdf" | "image/jpeg" | "image/png";
      colorMode: "BW" | "COLOR";
      paperSize: "A4" | "A3";
      copies: number;
    }> = [];
    for (const file of files) {
      const mimeType = file.type || "application/pdf";
      if (mimeType !== "application/pdf" && mimeType !== "image/jpeg" && mimeType !== "image/png") {
        throw new AuthServiceError(400, "only PDF, JPEG, and PNG files can be stored");
      }
      if (file.size === 0 || file.size > 15_000_000) {
        throw new AuthServiceError(400, "each PDF must be between 1 byte and 15 MB");
      }
      parsed.push({
        filename: file.name || "document.pdf",
        bytes: Buffer.from(await file.arrayBuffer()),
        mimeType: mimeType as "application/pdf" | "image/jpeg" | "image/png",
        colorMode,
        paperSize,
        copies,
      });
    }

    return runShopOrder(request, shopId, (user) => createPdfOrder(user, parsed, paymentMethod));
  } catch (error) {
    return authErrorResponse(error);
  }
}
