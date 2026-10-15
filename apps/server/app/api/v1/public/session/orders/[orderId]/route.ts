import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import { getGuestOrderTracking } from "@/src/modules/print-user/print-user.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  // The tracking copy shape, so the page reads it the same way as its live listener.
  return runPrintUser(request, (guest) => getGuestOrderTracking(guest, orderId));
}
