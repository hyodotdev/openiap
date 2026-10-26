import { v, type Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { ReceiptResponse } from "./shared";

export const VERIFICATION_JOB_DEADLINE_MS = 15 * 60_000;
export const VERIFICATION_JOB_RETENTION_MS = 24 * 60 * 60_000;
export const VERIFICATION_JOB_LEASE_MS = 12 * 60_000;
export const VERIFICATION_JOB_MAX_ATTEMPTS = 5;
export const VERIFICATION_JOB_PROJECT_CAPACITY = 128;
export const VERIFICATION_JOB_GLOBAL_CAPACITY = 1_024;
export const VERIFICATION_JOB_PROJECT_WORKERS = 2;
export const VERIFICATION_JOB_GLOBAL_WORKERS = 8;
export const VERIFICATION_JOB_POLL_SECONDS = 2;

export const verificationJobStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("expired"),
);
export type VerificationJobStatus = Infer<typeof verificationJobStatus>;

export const verificationJobCiphertext = v.object({
  iv: v.string(),
  ciphertext: v.string(),
  tag: v.string(),
});
export const verificationJobError = v.object({
  code: v.string(),
  message: v.string(),
});
export type VerificationJobError = Infer<typeof verificationJobError>;

export interface VerificationJobView {
  jobId: Id<"verificationJobs">;
  status: VerificationJobStatus;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
  receipt?: ReceiptResponse;
  error?: VerificationJobError;
  store: "apple" | "google" | "amazon" | "horizon";
  includeClientPayload?: boolean;
  includeTransactionDetails?: boolean;
  correlationId: string;
}

export function activeVerificationJob(status: VerificationJobStatus): boolean {
  return status === "queued" || status === "running";
}

export function expiredVerificationJobError(): VerificationJobError {
  return {
    code: "VERIFICATION_EXPIRED",
    message: "Verification did not finish before its deadline.",
  };
}
