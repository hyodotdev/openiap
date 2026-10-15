import { ConvexError, type Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  PlayStoreVerificationError,
  ReceiptVerificationError,
} from "../purchases/errors";
import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import type { ReceiptResponse } from "../purchases/shared";
import type { purchaseIssueCauseValidator } from "../utils/validation";
import { evidenceFingerprint, type PurchaseEvidence } from "./evidence";
import type { PurchaseIssueInput } from "./internal";

export type PurchaseIssueCause = Infer<typeof purchaseIssueCauseValidator>;

type ClassifiedIssue = { cause: PurchaseIssueCause; retryAfterSec?: number };

// Verification error codes from purchases/errors.ts. An unlisted store error is
// VERIFICATION_FAILED; INVALID_API_KEY has no project to record against.
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

function errorStatus(error: ReceiptVerificationError): unknown {
  return error.errorDetails?.status;
}

export function classifyVerificationError(
  error: unknown,
): ClassifiedIssue | null {
  // Google wraps the classified store error; read the one it wraps.
  const cause =
    error instanceof PlayStoreVerificationError && error.inner
      ? error.inner
      : error;
  if (cause instanceof ReceiptVerificationError) {
    if (cause.retryAfterSec !== undefined) {
      return {
        cause: "STORE_UNAVAILABLE",
        retryAfterSec: cause.retryAfterSec,
      };
    }
    switch (cause.errorCode) {
      case "INVALID_API_KEY":
        return null;
      case "APP_STORE_TRANSACTION_VERIFICATION_FAILED":
        // Apple's Server API answers 401/403 for credentials, never for a
        // forged or unknown transaction.
        return {
          cause:
            errorStatus(cause) === 401 || errorStatus(cause) === 403
              ? "CREDENTIALS_REJECTED"
              : "INAUTHENTIC",
        };
      case "AMAZON_RECEIPT_VERIFICATION_ERROR":
        // RVS answers 496 for an invalid shared secret.
        return {
          cause:
            errorStatus(cause) === 496
              ? "CREDENTIALS_REJECTED"
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

type VerifyIssueContext = {
  apiKey: string;
  evidence: PurchaseEvidence;
  expectedProductId?: string;
  correlationId?: string;
};

async function recordFromAction(
  ctx: ActionCtx,
  request: VerifyIssueContext,
  issue: Omit<PurchaseIssueInput, "store" | "fingerprint" | "correlationId">,
): Promise<void> {
  try {
    await ctx.runMutation(internal.purchaseIssues.internal.record, {
      apiKey: request.apiKey,
      issue: {
        ...issue,
        store: request.evidence.store,
        fingerprint: await evidenceFingerprint(request.evidence),
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
  let verdict: ReceiptResponse;
  try {
    verdict = await verify();
  } catch (error) {
    const issue = classifyVerificationError(error);
    if (issue) {
      await recordFromAction(ctx, request, {
        ...issue,
        ...(claimedProductId ? { claimedProductId } : {}),
      });
    }
    throw error;
  }

  const cause = classifyVerdict(verdict, request.expectedProductId);
  if (cause) {
    await recordFromAction(ctx, request, {
      cause,
      ...(verdict.productId && request.evidence.store !== "horizon"
        ? { productId: verdict.productId }
        : {}),
      ...(claimedProductId ? { claimedProductId } : {}),
      ...(verdict.environment ? { environment: verdict.environment } : {}),
    });
  }
  return verdict;
}
