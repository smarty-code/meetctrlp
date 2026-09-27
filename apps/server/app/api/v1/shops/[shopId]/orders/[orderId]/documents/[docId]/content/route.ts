import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import {
  readDocumentContent,
  verifyDownloadSignature,
} from "@/src/modules/documents/document.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string; orderId: string; docId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId, orderId, docId } = await context.params;
    const url = new URL(request.url);
    const expiresAt = Number(url.searchParams.get("exp"));
    const signature = url.searchParams.get("sig") ?? "";
    if (!verifyDownloadSignature(shopId, orderId, docId, expiresAt, signature)) {
      throw new AuthServiceError(401, "download link is invalid or expired");
    }

    const file = await readDocumentContent(shopId, orderId, docId);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
