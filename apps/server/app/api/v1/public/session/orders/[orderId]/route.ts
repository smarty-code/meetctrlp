import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import { getGuestOrder } from "@/src/modules/print-user/print-user.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  return runPrintUser(request, (session) => getGuestOrder(session, orderId));
}
