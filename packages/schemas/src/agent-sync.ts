import { z } from "zod";

import { orderTransitionRequestSchema } from "./orders";

// Agent-driven delivery contracts (TRAFFIC_SCALING_V2_IMPLEMENTATION.md 6.3, 6.5).

/** Accept, optionally naming the PC that accepted, so its printers are preferred for the jobs. */
export const acceptOrderRequestSchema = orderTransitionRequestSchema.extend({
  agentId: z.string().trim().min(8).max(64).optional(),
});

export const agentFinalJobStatusSchema = z.enum(["COMPLETED", "FAILED", "CANCELLED"]);

export const agentJobReportSchema = z.object({
  orderId: z.string().trim().min(1).max(80),
  jobId: z.string().trim().min(1).max(80),
  leaseId: z.string().trim().min(1).max(80),
  status: agentFinalJobStatusSchema,
  pagesPrinted: z.number().int().min(0).max(100_000).optional(),
  spoolerJobId: z.number().int().positive().nullable().optional(),
  errorCode: z.string().trim().min(1).max(80).nullable().optional(),
  errorMessage: z.string().trim().min(1).max(500).nullable().optional(),
});

/** `POST .../agents/{agentId}/jobs/report`: final reports only, at most 20 per request. */
export const reportAgentJobsRequestSchema = z.object({
  reports: z.array(agentJobReportSchema).min(1).max(20),
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

/** `POST .../agents/{agentId}/sync`. */
export type SyncAgentResponse = {
  accepted: string[];
  claimed: SyncClaimedJob[];
  /** True when a query hit its limit: call `sync` again straight away. */
  more: boolean;
};
