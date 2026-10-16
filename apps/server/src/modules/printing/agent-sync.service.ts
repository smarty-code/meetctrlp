// Agent-driven delivery (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.3). The agent calls `sync` when its
// doorbell's `workAt` changes, and `report` once per finished job. Both act on state, not events, so
// a lost or merged ring delays work but never loses it.
import { randomUUID } from "node:crypto";

import { FieldValue, getFirebaseFirestore, type DocumentReference } from "@ctrlp/firebase/firestore";
import { agentJobReportSchema } from "@ctrlp/schemas";
import type {
  AgentJobReportInput,
  AgentJobReportResult,
  ReportAgentJobsRequestInput,
  ReportAgentJobsResponse,
  SyncAgentRequestInput,
  SyncAgentResponse,
  SyncClaimedJob,
  SyncRevokedLease,
} from "@ctrlp/schemas";
import type { ShopPrincipal } from "@ctrlp/types";

import { touchAgentActivity } from "@/src/modules/devices/device.service";
import {
  AGENT_DOWNLOAD_TTL_SECONDS,
  documentDownload,
  shredOrderDocument,
  type StoredOrderDocument,
} from "@/src/modules/documents/document.service";
import { applyOrderChange } from "@/src/modules/orders/order.service";
import { STUCK_JOB_MS, allDocumentsDone, decideReport, revokedReason } from "@/src/modules/printing/job-model";
import { queueIncomingOrder } from "@/src/modules/printing/print-job.service";
import { ringShop } from "@/src/modules/realtime/doorbell";
import { getShopConfig } from "@/src/modules/shops/shop-config.service";

const SYNC_LIMIT = 10;
const ACTIVE_JOB_STATUSES = new Set(["QUEUED", "DISPATCHING", "PRINTING"]);

type OrderData = Record<string, unknown>;

function db() {
  return getFirebaseFirestore();
}

function orderRef(shopId: string, orderId: string) {
  return db().doc(`shops/${shopId}/orders/${orderId}`);
}

function documentsOf(order: OrderData) {
  return Array.isArray(order.documents) ? (order.documents as Array<Partial<StoredOrderDocument>>) : [];
}

function findDocument(order: OrderData, documentId: string) {
  return documentsOf(order).find((entry) => entry.docId === documentId || entry.id === documentId);
}

/** Step 1: accept paid online orders the shop wants accepted automatically. */
async function autoAcceptPaidOrders(principal: ShopPrincipal, agentId: string) {
  const config = await getShopConfig(principal);
  if (!config.orderAutomation.autoAcceptPaidOnline) {
    return { accepted: [] as string[], full: false };
  }

  const snapshot = await db()
    .collection(`shops/${principal.shopId}/orders`)
    .where("status", "==", "SUBMITTED")
    .where("payment.status", "==", "PAID")
    .limit(SYNC_LIMIT)
    .get();
  const accepted: string[] = [];

  for (const candidate of snapshot.docs) {
    let won = false;
    await db().runTransaction(async (transaction) => {
      won = false;
      const fresh = await transaction.get(candidate.ref);
      const data = fresh.data() ?? {};
      // Another PC may have accepted it since the query.
      if (data.status !== "SUBMITTED" || fresh.get("payment.status") !== "PAID" || fresh.get("payment.method") !== "ONLINE") {
        return;
      }
      won = applyOrderChange(transaction, candidate.ref, data, {
        status: "SHOP_ACCEPTED",
        fields: { "lifecycle.acceptedByUserId": `agent:${agentId}` },
      }).changed;
    });

    if (won) {
      accepted.push(candidate.id);
      if (config.orderAutomation.autoDispatchAcceptedOrders) {
        // This agent claims its own jobs below, so only jobs routed to other PCs ring `work`.
        await queueIncomingOrder(principal, candidate.id, { preferAgentId: agentId, quietAgentId: agentId });
      }
    }
  }

  return { accepted, full: snapshot.size >= SYNC_LIMIT };
}

type Claimed = { jobRef: DocumentReference; job: OrderData; leaseId: string; redelivered: boolean };

/** Step 2: lease this agent's queued jobs, moving their orders to PRINTING. */
async function claimQueuedJobs(principal: ShopPrincipal, agentId: string) {
  const snapshot = await db()
    .collectionGroup("printJobs")
    .where("shopId", "==", principal.shopId)
    .where("agentId", "==", agentId)
    .where("status", "==", "QUEUED")
    .orderBy("createdAt")
    .limit(SYNC_LIMIT)
    .get();
  if (snapshot.empty) {
    return { claimed: [] as Claimed[], full: false };
  }

  let claimed: Claimed[] = [];
  await db().runTransaction(async (transaction) => {
    claimed = [];
    const jobs = await Promise.all(snapshot.docs.map((doc) => transaction.get(doc.ref)));
    const orderIds = [...new Set(jobs.map((job) => String(job.get("orderId") ?? "")).filter(Boolean))];
    const orders = new Map(
      (await Promise.all(orderIds.map((id) => transaction.get(orderRef(principal.shopId, id))))).map((order) => [order.id, order]),
    );
    const now = FieldValue.serverTimestamp();
    const movedOrders = new Set<string>();

    for (const job of jobs) {
      if (!job.exists || job.get("status") !== "QUEUED" || job.get("agentId") !== agentId) {
        continue;
      }
      const leaseId = randomUUID();
      transaction.update(job.ref, { status: "DISPATCHING", leaseId, claimedAt: now, updatedAt: now });
      claimed.push({ jobRef: job.ref, job: job.data() ?? {}, leaseId, redelivered: false });

      const order = orders.get(String(job.get("orderId")));
      if (order?.exists && order.get("status") === "SHOP_ACCEPTED" && !movedOrders.has(order.id)) {
        applyOrderChange(transaction, order.ref, order.data() ?? {}, { status: "PRINTING" });
        movedOrders.add(order.id);
      }
    }
  });

  return { claimed, full: snapshot.size >= SYNC_LIMIT };
}

/**
 * Step 3: hand back this agent's jobs that have been DISPATCHING for 15 minutes, with the same lease.
 * Covers an agent that died between the claim and queuing the job locally; an agent that already
 * has the job skips it by lease, so nothing prints twice.
 */
async function redeliverStuckJobs(principal: ShopPrincipal, agentId: string) {
  const snapshot = await db()
    .collectionGroup("printJobs")
    .where("shopId", "==", principal.shopId)
    .where("agentId", "==", agentId)
    .where("status", "==", "DISPATCHING")
    .where("claimedAt", "<", new Date(Date.now() - STUCK_JOB_MS))
    .orderBy("claimedAt")
    .limit(SYNC_LIMIT)
    .get();
  if (snapshot.empty) {
    return { claimed: [] as Claimed[], full: false };
  }

  const batch = db().batch();
  const claimed: Claimed[] = [];
  for (const job of snapshot.docs) {
    const leaseId = job.get("leaseId");
    if (typeof leaseId !== "string" || !leaseId) {
      continue;
    }
    // Refreshing claimedAt keeps a live agent's job from looking rescuable to the operator, and
    // updatedAt carries that to the board's deltas, so it stops offering a Rescue that would 409.
    batch.update(job.ref, { claimedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    claimed.push({ jobRef: job.ref, job: job.data(), leaseId, redelivered: true });
  }
  await batch.commit();
  return { claimed, full: snapshot.size >= SYNC_LIMIT };
}

async function toSyncJobs(shopId: string, claimed: Claimed[], origin: string) {
  const orderIds = [...new Set(claimed.map((entry) => String(entry.job.orderId ?? "")))];
  const orders = new Map<string, OrderData>();
  if (orderIds.length > 0) {
    const snapshots = await db().getAll(...orderIds.map((id) => orderRef(shopId, id)));
    for (const snapshot of snapshots) {
      orders.set(snapshot.id, snapshot.data() ?? {});
    }
  }

  return Promise.all(claimed.map(async (entry): Promise<SyncClaimedJob> => {
    const orderId = String(entry.job.orderId ?? "");
    const documentId = String(entry.job.documentId ?? "");
    const order = orders.get(orderId) ?? {};
    const document = findDocument(order, documentId);
    const download = document
      ? await documentDownload(shopId, orderId, document, origin, AGENT_DOWNLOAD_TTL_SECONDS)
      : null;

    return {
      orderId,
      orderNumber: String(order.orderNumber ?? ""),
      jobId: entry.jobRef.id,
      documentId,
      documentName: String(document?.originalFilename ?? "document"),
      leaseId: entry.leaseId,
      resolvedSettings: (entry.job.resolvedSettings ?? {}) as Record<string, unknown>,
      printerId: String(entry.job.printerId ?? ""),
      printerSystemName: String(entry.job.printerSystemName ?? entry.job.printerName ?? ""),
      printerName: String(entry.job.printerName ?? ""),
      pagesTotal: Number(entry.job.pagesTotal ?? 1),
      redelivered: entry.redelivered,
      download: download
        ? {
            url: download.url,
            sha256Hash: download.sha256Hash,
            mimeType: download.mimeType,
            pageCount: download.pageCount,
            expiresIn: download.expiresIn,
          }
        : null,
    };
  }));
}

/**
 * Step 0: which of the leases the agent still holds it must drop. Read before claiming, so a job
 * the operator re-queued onto this same PC is revoked under its old lease and claimed under a new one.
 */
async function findRevokedLeases(principal: ShopPrincipal, agentId: string, held: SyncAgentRequestInput["held"]) {
  if (held.length === 0) {
    return [] as SyncRevokedLease[];
  }
  const jobs = await db().getAll(
    ...held.map((entry) => orderRef(principal.shopId, entry.orderId).collection("printJobs").doc(entry.jobId)),
  );
  return held.flatMap((entry, index): SyncRevokedLease[] => {
    const job = jobs[index];
    const reason = revokedReason(
      {
        exists: job.exists && job.get("shopId") === principal.shopId,
        status: String(job.get("status") ?? ""),
        leaseId: job.get("leaseId"),
        agentId: job.get("agentId"),
      },
      entry,
      agentId,
    );
    return reason ? [{ orderId: entry.orderId, jobId: entry.jobId, leaseId: entry.leaseId, reason }] : [];
  });
}

/**
 * `POST .../agents/{agentId}/sync`: say which held leases are revoked, accept paid orders, claim this
 * agent's queued jobs, and hand back stuck ones, with download links. Call it again while `more` is true.
 */
export async function syncAgent(
  principal: ShopPrincipal,
  agentId: string,
  origin: string,
  input: SyncAgentRequestInput = { held: [] },
): Promise<SyncAgentResponse> {
  const revoked = await findRevokedLeases(principal, agentId, input.held);
  const accepting = await autoAcceptPaidOrders(principal, agentId);
  const claiming = await claimQueuedJobs(principal, agentId);
  const redelivering = await redeliverStuckJobs(principal, agentId);
  const claimed = await toSyncJobs(principal.shopId, [...claiming.claimed, ...redelivering.claimed], origin);

  if (accepting.accepted.length > 0 || claiming.claimed.length > 0) {
    const first = claimed[0];
    await ringShop(principal.shopId, {
      work: false,
      event: "order_updated",
      orderId: first?.orderId ?? accepting.accepted[0] ?? "",
      orderNumber: first?.orderNumber ?? "",
    });
  }
  await touchAgentActivity(principal.shopId, agentId);

  return {
    accepted: accepting.accepted,
    claimed,
    revoked,
    more: accepting.full || claiming.full || redelivering.full,
  };
}

type ReportOutcome = { result: AgentJobReportResult; changed: boolean; shred?: { orderId: string; documentId: string } };

async function applyReport(principal: ShopPrincipal, agentId: string, report: AgentJobReportInput): Promise<ReportOutcome> {
  const ref = orderRef(principal.shopId, report.orderId);
  const jobRef = ref.collection("printJobs").doc(report.jobId);
  let outcome: ReportOutcome = { result: "not_found", changed: false };

  await db().runTransaction(async (transaction) => {
    const [jobSnap, orderSnap] = await Promise.all([transaction.get(jobRef), transaction.get(ref)]);
    if (!jobSnap.exists || !orderSnap.exists) {
      outcome = { result: "not_found", changed: false };
      return;
    }

    const documentId = String(jobSnap.get("documentId") ?? "");
    const decision = decideReport(
      { status: String(jobSnap.get("status") ?? ""), leaseId: jobSnap.get("leaseId"), agentId: jobSnap.get("agentId") },
      report,
      agentId,
    );

    if (decision.kind === "replay") {
      // Nothing to write, but a COMPLETED job may still need its file deleted.
      outcome = { result: "ok", changed: false, shred: report.status === "COMPLETED" ? { orderId: report.orderId, documentId } : undefined };
      return;
    }
    if (decision.kind === "reject") {
      outcome = { result: decision.result, changed: false };
      return;
    }

    const now = FieldValue.serverTimestamp();
    const pagesTotal = Number(jobSnap.get("pagesTotal") ?? 1);
    transaction.update(jobRef, {
      status: report.status,
      ...(report.pagesPrinted !== undefined ? { pagesPrinted: Math.min(report.pagesPrinted, pagesTotal) } : {}),
      ...(report.spoolerJobId !== undefined ? { spoolerJobId: report.spoolerJobId } : {}),
      ...(report.errorCode !== undefined ? { errorCode: report.errorCode } : {}),
      ...(report.errorMessage !== undefined ? { errorMessage: report.errorMessage } : {}),
      completedAt: now,
      updatedAt: now,
    });

    if (report.status === "COMPLETED" && documentId) {
      const order = orderSnap.data() ?? {};
      const allDone = allDocumentsDone(documentsOf(order), order.completedDocumentIds, documentId);
      applyOrderChange(transaction, ref, order, {
        status: allDone && order.status === "PRINTING" ? "READY" : undefined,
        fields: { completedDocumentIds: FieldValue.arrayUnion(documentId) },
      });
      outcome = { result: "ok", changed: true, shred: { orderId: report.orderId, documentId } };
      return;
    }

    outcome = { result: "ok", changed: true };
  });

  return outcome;
}

/** Deletes a printed file unless another active job still needs it. False means "retry". */
async function shredIfUnused(shopId: string, orderId: string, jobId: string, documentId: string) {
  const siblings = await orderRef(shopId, orderId).collection("printJobs").where("documentId", "==", documentId).get();
  if (siblings.docs.some((job) => job.id !== jobId && ACTIVE_JOB_STATUSES.has(String(job.get("status"))))) {
    return true;
  }
  return shredOrderDocument(shopId, orderId, documentId);
}

/** The job id of a report the server could not read, if it has one to answer to. */
function unreadableReportJobId(raw: unknown) {
  const jobId = raw && typeof raw === "object" ? (raw as { jobId?: unknown }).jobId : undefined;
  return typeof jobId === "string" && jobId.trim() ? jobId.trim() : null;
}

/**
 * `POST .../agents/{agentId}/jobs/report`: final job results. Each report is parsed on its own and
 * is its own transaction, with its own result, so one bad report never fails the batch. One the
 * server can't read is answered `invalid_state`, which the agent treats as final (not retried).
 */
export async function reportAgentJobs(
  principal: ShopPrincipal,
  agentId: string,
  input: ReportAgentJobsRequestInput,
): Promise<ReportAgentJobsResponse> {
  const results: ReportAgentJobsResponse["results"] = [];
  let changedOrder: string | undefined;

  for (const raw of input.reports) {
    const parsed = agentJobReportSchema.safeParse(raw);
    if (!parsed.success) {
      const jobId = unreadableReportJobId(raw);
      console.error("Unreadable agent job report", agentId, jobId, parsed.error.issues[0]?.message);
      if (jobId) {
        results.push({ jobId, result: "invalid_state" });
      }
      continue;
    }
    const report = parsed.data;
    const outcome = await applyReport(principal, agentId, report);
    let result = outcome.result;
    if (outcome.shred && !(await shredIfUnused(principal.shopId, outcome.shred.orderId, report.jobId, outcome.shred.documentId))) {
      result = "retry";
    }
    if (outcome.changed) {
      changedOrder ??= report.orderId;
    }
    results.push({ jobId: report.jobId, result });
  }

  if (changedOrder) {
    await ringShop(principal.shopId, { work: false, event: "order_updated", orderId: changedOrder, orderNumber: "" });
  }
  await touchAgentActivity(principal.shopId, agentId);

  return { results };
}
