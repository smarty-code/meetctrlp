import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import { cancelGuestOrder } from "@/src/modules/print-user/print-user.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orderId: string }> };

/** The guest cancels their order while it is SUBMITTED and unpaid. Returns the tracking copy shape. */
export async function POST(request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  return runPrintUser(request, (guest) => cancelGuestOrder(guest, orderId));
}
