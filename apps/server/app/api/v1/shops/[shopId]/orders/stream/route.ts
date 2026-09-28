import { readAuthorizedShopUser } from "@/src/modules/auth/require-request";
import { AuthServiceError } from "@/src/modules/auth/auth.errors";
import { authErrorResponse } from "@/src/modules/auth/auth-http";
import { subscribeShopOrders } from "@/src/modules/orders/order.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ shopId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { shopId } = await context.params;
    const user = await readAuthorizedShopUser(request);

    if (user.shopId !== shopId) {
      throw new AuthServiceError(403, "shop does not match this account");
    }

    const encoder = new TextEncoder();
    let unsubscribe = () => {};
    let closed = false;

    const stream = new ReadableStream({
      start(controller) {
        const send = (event: string, data: unknown) => {
          if (closed) {
            return;
          }

          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        unsubscribe = subscribeShopOrders(shopId, {
          onSnapshot: (orders) => send("ORDERS_SNAPSHOT", { orders }),
          onCreated: (order) => send("ORDER_CREATED", order),
          onChanged: (order) => send("ORDER_STATUS_CHANGED", order),
          onJobChanged: (job) => send("PRINT_JOB_CHANGED", job),
          onError: (error) => send("ERROR", { error: error.message }),
        });

        const ping = setInterval(() => {
          send("ping", {});
        }, 15_000);

        const close = () => {
          if (closed) {
            return;
          }

          closed = true;
          clearInterval(ping);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // The client may already have closed the stream.
          }
        };

        request.signal.addEventListener("abort", close);
      },
      cancel() {
        closed = true;
        unsubscribe();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
