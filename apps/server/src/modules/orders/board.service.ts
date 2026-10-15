// The desktop's order board, history and search (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.4). The
// board is fetched in full on start, then as deltas after a doorbell ring while the window is
// visible, so a shop with no changes costs nothing.
import { getFirebaseFirestore, type Query } from "@ctrlp/firebase/firestore";
import type { OrderHistoryQueryInput, OrderSearchQueryInput } from "@ctrlp/schemas";
import type { ShopPrincipal } from "@ctrlp/types";

import {
  ACTIVE_ORDER_STATUSES,
  DELTA_CAP,
  UNFINISHED_JOB_STATUSES,
  deltaStart,
  shopDateRange,
} from "@/src/modules/orders/board-model";
import { toOrderDto, type OrderDto } from "@/src/modules/orders/order.service";
import { toPrintJobDto, type PrintJobDto } from "@/src/modules/printing/print-job.service";

const SEARCH_PAGE = 50;

export type BoardResponse = {
  /** True: replace the whole board. False: upsert these orders and jobs by `(id, updatedAt)`. */
  full: boolean;
  orders: OrderDto[];
  jobs: PrintJobDto[];
  /** Pass back as `since` next time. */
  cursor: string;
};

function orders(shopId: string) {
  return getFirebaseFirestore().collection(`shops/${shopId}/orders`);
}

function shopJobs(shopId: string) {
  return getFirebaseFirestore().collectionGroup("printJobs").where("shopId", "==", shopId);
}

/** Active orders and unfinished jobs, or what changed since the cursor. */
export async function getBoard(user: ShopPrincipal, since: string | undefined): Promise<BoardResponse> {
  // The server's clock at request start; the next delta overlaps it by 5 s.
  const now = Date.now();
  const cursor = new Date(now).toISOString();
  const start = deltaStart(since, now);

  if (start) {
    const [changedOrders, changedJobs] = await Promise.all([
      orders(user.shopId).where("updatedAt", ">", start).orderBy("updatedAt").limit(DELTA_CAP + 1).get(),
      shopJobs(user.shopId).where("updatedAt", ">", start).orderBy("updatedAt").limit(DELTA_CAP + 1).get(),
    ]);
    if (changedOrders.size <= DELTA_CAP && changedJobs.size <= DELTA_CAP) {
      return {
        full: false,
        orders: changedOrders.docs.map(toOrderDto),
        jobs: changedJobs.docs.map(toPrintJobDto),
        cursor,
      };
    }
  }

  const [activeOrders, unfinishedJobs] = await Promise.all([
    orders(user.shopId).where("status", "in", [...ACTIVE_ORDER_STATUSES]).get(),
    shopJobs(user.shopId).where("status", "in", [...UNFINISHED_JOB_STATUSES]).get(),
  ]);
  return {
    full: true,
    orders: activeOrders.docs.map(toOrderDto).sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? "")),
    jobs: unfinishedJobs.docs.map(toPrintJobDto),
    cursor,
  };
}

async function pageAfter(
  query: Query,
  shopId: string,
  cursor: string | undefined,
  limit: number,
) {
  let page = query;
  if (cursor) {
    const last = await orders(shopId).doc(cursor).get();
    if (last.exists) {
      page = page.startAfter(last);
    }
  }
  const snapshot = await page.limit(limit + 1).get();
  const documents = snapshot.docs.slice(0, limit);
  return {
    orders: documents.map(toOrderDto),
    nextCursor: snapshot.size > limit ? documents[documents.length - 1].id : null,
  };
}

/** Paged order history, newest first, optionally by status and by shop-time date. */
export async function listOrderHistory(user: ShopPrincipal, input: OrderHistoryQueryInput) {
  let query: Query = orders(user.shopId);
  if (input.status.length > 0) {
    query = query.where("status", "in", input.status);
  }
  const range = shopDateRange(input.from, input.to);
  if (range.start) {
    query = query.where("createdAt", ">=", range.start);
  }
  if (range.end) {
    query = query.where("createdAt", "<", range.end);
  }
  return pageAfter(query.orderBy("createdAt", "desc"), user.shopId, input.cursor, input.limit);
}

/** Orders whose order number, pickup code, phone digits or filename words match `q` exactly. */
export async function searchOrders(user: ShopPrincipal, input: OrderSearchQueryInput) {
  const query = orders(user.shopId).where("searchKeys", "array-contains", input.q).orderBy("createdAt", "desc");
  return pageAfter(query, user.shopId, input.cursor, SEARCH_PAGE);
}

