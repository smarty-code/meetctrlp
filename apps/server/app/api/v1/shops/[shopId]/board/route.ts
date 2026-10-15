import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { getBoard } from "@/src/modules/orders/board.service";
import { runShopOrder } from "@/src/modules/orders/order-http";
import { parseQuery } from "@/src/modules/shops/shop-route";
import { boardQuerySchema } from "@ctrlp/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

/** Active orders and unfinished jobs, or the changes since `?since=<cursor>` (TRAFFIC_SCALING_V2 6.4). */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    const query = parseQuery(request, boardQuerySchema);
    return runShopOrder(request, shopId, (user) => getBoard(user, query.since));
  } catch (error) {
    return authErrorResponse(error);
  }
}
