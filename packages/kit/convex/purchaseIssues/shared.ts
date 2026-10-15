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

// Only these causes are a store's answer about a purchase it verified, so only
// they are keyed by the evidence's fingerprint. Every other cause, including
// evidence no store recognized (a forged JWS, an unknown token, Meta's
// `success: false`), shares one row per (store, cause), so random input cannot
// grow the log or evict the rows support needs.
const EVIDENCE_CAUSES: ReadonlySet<PurchaseIssueCause> = new Set([
  "PRODUCT_MISMATCH",
  "STORE_PENDING",
]);

export type ClassifiedIssue = {
  cause: PurchaseIssueCause;
  retryAfterSec?: number;
};

// Causes by error code from purchases/errors.ts. An unlisted code is
// VERIFICATION_FAILED.
const CAUSE_BY_ERROR_CODE: Record<string, PurchaseIssueCause> = {
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
  PLAY_STORE_PURCHASE_NOT_FOUND: "INAUTHENTIC",
};

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
      return { cause: "STORE_UNAVAILABLE", retryAfterSec: cause.retryAfterSec };
    }
    switch (cause.errorCode) {
      case "INVALID_API_KEY":
        return null;
      case "APP_STORE_TRANSACTION_VERIFICATION_FAILED":
        return {
          cause: rejectsCredentials(cause)
            ? "CREDENTIALS_REJECTED"
            : "INAUTHENTIC",
        };
      case "META_HORIZON_VERIFICATION_ERROR":
        return {
          cause: rejectsCredentials(cause)
            ? "CREDENTIALS_REJECTED"
            : "VERIFICATION_FAILED",
        };
      case "AMAZON_RECEIPT_VERIFICATION_ERROR":
        // RVS answers 496 for an invalid shared secret.
        return {
          cause:
            cause.errorDetails?.status === 496
              ? "CREDENTIALS_REJECTED"
              : cause.errorDetails?.outage === true
                ? "STORE_UNAVAILABLE"
                : "VERIFICATION_FAILED",
        };
      default:
        return {
          cause: CAUSE_BY_ERROR_CODE[cause.errorCode] ?? "VERIFICATION_FAILED",
        };
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
      ...(typeof retryAfterSec === "number" ? { retryAfterSec } : {}),
    };
  }
  return null;
}

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
  > = {},
): Promise<void> {
  try {
    const { store } = request.evidence;
    const projectScoped = !EVIDENCE_CAUSES.has(issue.cause);
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
  let verdict: ReceiptResponse;
  try {
    verdict = await verify();
  } catch (error) {
    const issue = classifyVerificationError(error);
    if (issue) await scheduleRecord(ctx, request, issue);
    throw error;
  }

  const cause = classifyVerdict(verdict, request.expectedProductId);
  if (cause) {
    await scheduleRecord(
      ctx,
      request,
      { cause },
      {
        ...(verdict.productId ? { productId: verdict.productId } : {}),
        ...(request.expectedProductId
          ? { claimedProductId: request.expectedProductId }
          : {}),
        ...(verdict.environment ? { environment: verdict.environment } : {}),
      },
    );
  }
  return verdict;
}
