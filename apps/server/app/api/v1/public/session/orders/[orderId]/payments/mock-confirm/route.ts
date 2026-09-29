import { parseBody } from "@/src/modules/shops/shop-route";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import { mockConfirmGuestPayment } from "@/src/modules/print-user/print-user.service";
import { printUserMockConfirmRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orderId } = await context.params;
    const body = await parseBody(request, printUserMockConfirmRequestSchema);
    return runPrintUser(request, (session) => mockConfirmGuestPayment(session, orderId, body.idempotencyKey));
  } catch (error) {
    return authErrorResponse(error);
  }
}
