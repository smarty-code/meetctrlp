import { z } from "zod";

import { orderTransitionRequestSchema } from "./orders";

// Agent-driven delivery contracts (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.3, 6.5).

/** Accept, optionally naming the PC that accepted, so its printers are preferred for the jobs. */
export const acceptOrderRequestSchema = orderTransitionRequestSchema.extend({
  agentId: z.string().trim().min(8).max(64).optional(),
});

export const agentFinalJobStatusSchema = z.enum(["COMPLETED", "FAILED", "CANCELLED"]);

/** Trimmed and cut to `max` characters, an empty one as null: a long Windows error never fails a report. */
const reportText = (max: number) =>
  z
    .string()
    .transform((value) => value.trim().slice(0, max) || null)
    .nullable()
    .optional();

export const agentJobReportSchema = z.object({
  orderId: z.string().trim().min(1).max(80),
  jobId: z.string().trim().min(1).max(80),
  leaseId: z.string().trim().min(1).max(80),
  status: agentFinalJobStatusSchema,
  // The server clamps it to the job's own page total, so a large count is accepted, not refused.
  pagesPrinted: z.number().int().min(0).optional(),
  spoolerJobId: z.number().int().positive().nullable().optional(),
  errorCode: reportText(80),
  errorMessage: reportText(500),
});

/**
 * `POST .../agents/{agentId}/jobs/report`: final reports only, at most 20 per request. Each report
 * is parsed on its own (`agentJobReportSchema`), so one the server can't read gets its own
 * `invalid_state` result instead of failing the batch.
 */
export const reportAgentJobsRequestSchema = z.object({
  reports: z.array(z.unknown()).min(1).max(20),
});

export type AcceptOrderRequestInput = z.infer<typeof acceptOrderRequestSchema>;
export type AgentJobReportInput = z.infer<typeof agentJobReportSchema>;
export type ReportAgentJobsRequestInput = z.infer<typeof reportAgentJobsRequestSchema>;

export type AgentJobReportResult = "ok" | "retry" | "lease_mismatch" | "invalid_state" | "not_found";

export type ReportAgentJobsResponse = {
  results: Array<{ jobId: string; result: AgentJobReportResult }>;
};

export type AgentJobDownload = {
  url: string;
  sha256Hash: string;
  mimeType: string;
  pageCount: number;
  expiresIn: number;
};

export type SyncClaimedJob = {
  orderId: string;
  orderNumber: string;
  jobId: string;
  documentId: string;
  documentName: string;
  leaseId: string;
  resolvedSettings: Record<string, unknown>;
  printerId: string;
  printerSystemName: string;
  printerName: string;
  pagesTotal: number;
  /** True when this is a job the agent claimed earlier and may already hold. */
  redelivered: boolean;
  /** Null when the file can't be downloaded any more (for example it was shredded). */
  download: AgentJobDownload | null;
};

/**
 * `POST .../agents/{agentId}/sync` body. `held` lists the leases of cloud jobs the agent has queued
 * or is printing and has not finished, so the server can say which of them are no longer its to
 * print. An agent that sends nothing (`{}`) gets no `revoked`.
 */
export const syncAgentRequestSchema = z
  .object({
    held: z
      .array(
        z.object({
          orderId: z.string().trim().min(1).max(80),
          jobId: z.string().trim().min(1).max(80),
          leaseId: z.string().trim().min(1).max(80),
        }),
      )
      .max(100)
      .default([]),
  })
  .default({});

export type SyncAgentRequestInput = z.infer<typeof syncAgentRequestSchema>;

/**
 * A held lease the agent must drop without printing (and without reporting):
 * - `CANCELLED`: the shop cancelled the job.
 * - `RESCUED`: the operator re-queued it, or it now has another lease or another PC.
 * - `FINISHED`: the server already has its final result.
 * - `NOT_FOUND`: the job or its order is gone.
 */
export type SyncRevokedLease = {
  orderId: string;
  jobId: string;
  leaseId: string;
  reason: "NOT_FOUND" | "CANCELLED" | "RESCUED" | "FINISHED";
};

/** `POST .../agents/{agentId}/sync`. */
export type SyncAgentResponse = {
  accepted: string[];
  claimed: SyncClaimedJob[];
  /** Held leases that are no longer valid; apply these before queuing `claimed`. */
  revoked: SyncRevokedLease[];
  /** True when a query hit its limit: call `sync` again straight away. */
  more: boolean;
};
