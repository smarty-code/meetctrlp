import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { createSinglePagePrintOrder } from "@/src/modules/orders/order.service";
import { runShopOrder } from "@/src/modules/orders/order-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "text/plain"]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    const form = await request.formData();
    const colorMode = String(form.get("colorMode") ?? "");
    const orientation = String(form.get("orientation") ?? "");
    const copies = Number(form.get("copies") ?? "1");
    const file = form.get("file");

    if (orientation !== "PORTRAIT") {
      throw new AuthServiceError(400, "this printer only accepts a portrait page");
    }

    if (copies !== 1) {
      throw new AuthServiceError(400, "this printer only prints a single copy");
    }

    if (colorMode !== "BW" && colorMode !== "COLOR") {
      throw new AuthServiceError(400, "colorMode must be BW or COLOR");
    }

    if (!(file instanceof File)) {
      throw new AuthServiceError(400, "file is required");
    }

    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new AuthServiceError(400, "upload a png, jpeg, or text file");
    }

    if (file.size === 0 || file.size > 5_000_000) {
      throw new AuthServiceError(400, "file must be between 1 byte and 5 MB");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    return runShopOrder(request, shopId, (user) =>
      createSinglePagePrintOrder(user, {
        filename: file.name || "page.txt",
        contentType,
        colorMode,
        bytes,
      }),
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
