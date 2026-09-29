import { parseBody } from "@/src/modules/shops/shop-route";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { runPrintUser } from "@/src/modules/print-user/print-user-http";
import { submitGuestOrder } from "@/src/modules/print-user/print-user.service";
import { printUserSubmitOrderRequestSchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, printUserSubmitOrderRequestSchema);
    return runPrintUser(request, (session) => submitGuestOrder(session, body));
  } catch (error) {
    return authErrorResponse(error);
  }
}
