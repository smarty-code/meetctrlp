import { jsonResponse } from "@/src/lib/http";
import { parseBody } from "@/src/modules/shops/shop-route";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import { mockPaymentsAllowed } from "@/src/modules/print-user/print-user.helpers";
import { mockConfirmGuestPayment } from "@/src/modules/print-user/print-user.service";
import { printUserMockConfirmRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, context: RouteContext) {
  // Off unless ALLOW_MOCK_PAYMENTS=1, so a guest can't mark an order paid without paying.
  if (!mockPaymentsAllowed()) {
    return jsonResponse({ error: "not found" }, { status: 404 });
  }

  try {
    const { orderId } = await context.params;
    const body = await parseBody(request, printUserMockConfirmRequestSchema);
    return runPrintUser(request, (session) => mockConfirmGuestPayment(session, orderId, body.idempotencyKey));
  } catch (error) {
    return authErrorResponse(error);
  }
}
