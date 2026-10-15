import { ConvexError, type Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  PlayStoreVerificationError,
  ReceiptVerificationError,
} from "../purchases/errors";
import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import type { ReceiptResponse } from "../purchases/shared";
import type { purchaseStoreValidator } from "../schema";
import { sha256Hex } from "../utils/sha256";
import type { purchaseIssueCauseValidator } from "../utils/validation";
import { purchaseEvidence, type PurchaseEvidence } from "./evidence";
import type { PurchaseIssueInput } from "./internal";

export type PurchaseIssueCause = Infer<typeof purchaseIssueCauseValidator>;

/**
 * `evidence` issues are keyed by the evidence's fingerprint; they come only
 * from a store's answer, which every pipeline asks after admission. `project`
 * issues (configuration, credentials, rejected input, rate limits, outages)
 * share one row per (store, cause), so requests that never reach admission
 * cannot grow the log.
 */
export type ClassifiedIssue = {
  cause: PurchaseIssueCause;
  scope: "evidence" | "project";
  retryAfterSec?: number;
};

// Project-level error codes from purchases/errors.ts. An unlisted code is a
// project-scoped VERIFICATION_FAILED, so a new error can never key on evidence.
const PROJECT_CAUSE_BY_ERROR_CODE: Record<string, PurchaseIssueCause> = {
  PROJECT_APP_STORE_BUNDLE_ID_NOT_CONFIGURED: "STORE_NOT_CONFIGURED",
  PROJECT_APP_STORE_APPLE_ID_NOT_CONFIGURED: "STORE_NOT_CONFIGURED",
  PROJECT_ANDROID_PACKAGE_NAME_NOT_CONFIGURED: "STORE_NOT_CONFIGURED",
  META_HORIZON_NOT_ENABLED: "STORE_NOT_CONFIGURED",
  META_HORIZON_APP_ID_NOT_CONFIGURED: "STORE_NOT_CONFIGURED",
  APP_STORE_SERVER_CREDENTIALS_MISSING: "CREDENTIALS_MISSING",
  PLAY_STORE_SERVICE_ACCOUNT_NOT_FOUND: "CREDENTIALS_MISSING",
  PLAY_STORE_FILE_CONTENT_NOT_READABLE: "CREDENTIALS_MISSING",
  INVALID_SERVICE_ACCOUNT_KEY_FORMAT: "CREDENTIALS_MISSING",
  INVALID_SERVICE_ACCOUNT_TYPE: "CREDENTIALS_MISSING",
  SERVICE_ACCOUNT_PRIVATE_KEY_MISSING: "CREDENTIALS_MISSING",
  SERVICE_ACCOUNT_CLIENT_EMAIL_MISSING: "CREDENTIALS_MISSING",
  SERVICE_ACCOUNT_PROJECT_ID_MISSING: "CREDENTIALS_MISSING",
  AMAZON_SHARED_SECRET_NOT_CONFIGURED: "CREDENTIALS_MISSING",
  META_HORIZON_APP_SECRET_NOT_CONFIGURED: "CREDENTIALS_MISSING",
  PLAY_STORE_AUTHENTICATION_FAILED: "CREDENTIALS_REJECTED",
  PLAY_STORE_INVALID_CREDENTIALS: "CREDENTIALS_REJECTED",
  PLAY_STORE_INSUFFICIENT_PERMISSIONS: "CREDENTIALS_REJECTED",
  APP_STORE_BUNDLE_ID_MISMATCH: "APP_MISMATCH",
  APP_STORE_INVALID_JWS_FORMAT: "MALFORMED_EVIDENCE",
  AMAZON_SANDBOX_NOT_ENABLED: "SANDBOX_NOT_ALLOWED",
};

const evidenceIssue = (cause: PurchaseIssueCause): ClassifiedIssue => ({
  cause,
  scope: "evidence",
});
const projectIssue = (cause: PurchaseIssueCause): ClassifiedIssue => ({
  cause,
  scope: "project",
});

function rejectsCredentials(error: ReceiptVerificationError): boolean {
  const status = error.errorDetails?.status;
  return status === 401 || status === 403;
}

export function classifyVerificationError(
  error: unknown,
): ClassifiedIssue | null {
  if (error instanceof PlayStoreVerificationError && error.writeConflict) {
    return null;
  }
  // Google wraps the classified store error; read the one it wraps.
  const cause =
    error instanceof PlayStoreVerificationError && error.inner
      ? error.inner
      : error;
  if (cause instanceof ReceiptVerificationError) {
    if (cause.retryAfterSec !== undefined) {
      return {
        cause: "STORE_UNAVAILABLE",
        scope: "project",
        retryAfterSec: cause.retryAfterSec,
      };
    }
    switch (cause.errorCode) {
      case "INVALID_API_KEY":
        return null;
      // The store answered about this evidence.
      case "APP_STORE_TRANSACTION_VERIFICATION_FAILED":
        return rejectsCredentials(cause)
          ? projectIssue("CREDENTIALS_REJECTED")
          : evidenceIssue("INAUTHENTIC");
      case "PLAY_STORE_PURCHASE_NOT_FOUND":
        return evidenceIssue("INAUTHENTIC");
      case "PLAY_STORE_PURCHASE_VERIFICATION_FAILED":
        return evidenceIssue("VERIFICATION_FAILED");
      case "META_HORIZON_VERIFICATION_ERROR":
        return rejectsCredentials(cause)
          ? projectIssue("CREDENTIALS_REJECTED")
          : evidenceIssue("VERIFICATION_FAILED");
      case "AMAZON_RECEIPT_VERIFICATION_ERROR":
        // RVS answers 496 for an invalid shared secret.
        return cause.errorDetails?.status === 496
          ? projectIssue("CREDENTIALS_REJECTED")
          : cause.errorDetails?.outage === true
            ? projectIssue("STORE_UNAVAILABLE")
            : evidenceIssue("VERIFICATION_FAILED");
      default:
        return projectIssue(
          PROJECT_CAUSE_BY_ERROR_CODE[cause.errorCode] ?? "VERIFICATION_FAILED",
        );
    }
  }
  if (
    cause instanceof ConvexError &&
    typeof cause.data === "object" &&
    cause.data !== null &&
    (cause.data as { code?: unknown }).code === "RATE_LIMITED"
  ) {
    const retryAfterSec = (cause.data as { retryAfterSec?: unknown })
      .retryAfterSec;
    return {
      cause: "RATE_LIMITED",
      scope: "project",
      ...(typeof retryAfterSec === "number" ? { retryAfterSec } : {}),
    };
  }
  return null;
}

/** Verdicts come from the store, so their issues key on the evidence. */
export function classifyVerdict(
  verdict: Pick<ReceiptResponse, "state" | "productId">,
  expectedProductId: string | undefined,
): PurchaseIssueCause | null {
  if (
    expectedProductId !== undefined &&
    verdict.productId !== undefined &&
    verdict.productId !== expectedProductId
  ) {
    return "PRODUCT_MISMATCH";
  }
  if (verdict.state === HarmonizedPurchaseState.INAUTHENTIC) {
    return "INAUTHENTIC";
  }
  if (verdict.state === HarmonizedPurchaseState.PENDING) {
    return "STORE_PENDING";
  }
  return null;
}

/** The one digest a project-scoped issue uses for its store and cause. */
export function projectIssueDigest(
  store: Infer<typeof purchaseStoreValidator>,
  cause: PurchaseIssueCause,
): Promise<string> {
  return sha256Hex(`project-issue:${store}:${cause}`);
}

// A project-scoped row is rewritten at most once per window, so its `count`
// is a lower bound.
export const PROJECT_ISSUE_THROTTLE_MS = 60_000;

type VerifyIssueContext = {
  apiKey: string;
  evidence: PurchaseEvidence;
  expectedProductId?: string;
  correlationId?: string;
};

// Schedules the record, so neither its write nor a failure delays or changes
// the verification answer.
async function scheduleRecord(
  ctx: ActionCtx,
  request: VerifyIssueContext,
  issue: ClassifiedIssue,
  details: Pick<
    PurchaseIssueInput,
    "productId" | "claimedProductId" | "environment"
  >,
): Promise<void> {
  try {
    const { store } = request.evidence;
    const projectScoped = issue.scope === "project";
    const digest = projectScoped
      ? await projectIssueDigest(store, issue.cause)
      : await sha256Hex(purchaseEvidence(request.evidence));
    const projectId = await ctx.runQuery(
      internal.purchaseIssues.internal.issueRecordTarget,
      {
        apiKey: request.apiKey,
        ...(projectScoped
          ? {
              projectScoped: {
                digest,
                cause: issue.cause,
                seenSince: Date.now() - PROJECT_ISSUE_THROTTLE_MS,
              },
            }
          : {}),
      },
    );
    if (!projectId) return;
    await ctx.scheduler.runAfter(0, internal.purchaseIssues.internal.record, {
      projectId,
      issue: {
        cause: issue.cause,
        store,
        digest,
        ...(projectScoped ? {} : details),
        ...(issue.retryAfterSec !== undefined
          ? { retryAfterSec: issue.retryAfterSec }
          : {}),
        ...(request.correlationId
          ? { correlationId: request.correlationId }
          : {}),
      },
    });
  } catch (error) {
    // The log is for support; it must never change a verification answer.
    console.error(
      "[purchase-issues] record failed: %s",
      error instanceof Error ? error.name : typeof error,
    );
  }
}

/**
 * Runs one public verification and records its failure, if any. The verdict
 * and any thrown error reach the caller unchanged.
 */
export async function verifyRecordingIssues(
  ctx: ActionCtx,
  request: VerifyIssueContext,
  verify: () => Promise<ReceiptResponse>,
): Promise<ReceiptResponse> {
  // Horizon's sku is the caller's claim until Meta grants it.
  const claimedProductId =
    request.evidence.store === "horizon"
      ? request.evidence.sku
      : request.expectedProductId;
  const claimed = claimedProductId ? { claimedProductId } : {};
  let verdict: ReceiptResponse;
  try {
    verdict = await verify();
  } catch (error) {
    const issue = classifyVerificationError(error);
    if (issue) await scheduleRecord(ctx, request, issue, claimed);
    throw error;
  }

  const cause = classifyVerdict(verdict, request.expectedProductId);
  if (cause) {
    await scheduleRecord(
      ctx,
      request,
      { cause, scope: "evidence" },
      {
        ...(verdict.productId && request.evidence.store !== "horizon"
          ? { productId: verdict.productId }
          : {}),
        ...claimed,
        ...(verdict.environment ? { environment: verdict.environment } : {}),
      },
    );
  }
  return verdict;
}
