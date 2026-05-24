"use node";

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import {
  AmazonReceiptInvalidError,
  AmazonReceiptVerificationError,
  AmazonSharedSecretNotConfiguredError,
  ReceiptVerificationError,
} from "./errors";
import { HarmonizedPurchaseState } from "./purchaseState";
import {
  extractHttpStatus,
  isTransientHttpError,
  retryOnTransient,
} from "./retry";
import {
  getProjectByApiKey,
  isValidState,
  receiptResponseValidator,
} from "./shared";

const AMAZON_RVS_BASE_URL = "https://appstore-sdk.amazon.com";
const AMAZON_RVS_VERSION = "1.0";
const AMAZON_SANDBOX_SHARED_SECRET = "iapkit-sandbox";
const AMAZON_RVS_FETCH_TIMEOUT_MS = 10_000;

export interface AmazonReceiptData {
  autoRenewing?: boolean;
  cancelDate?: number | null;
  cancelReason?: number | null;
  gracePeriodEndDate?: number | null;
  productId?: string;
  productType?: string;
  purchaseDate?: number;
  quantity?: number | null;
  receiptId?: string;
  renewalDate?: number | null;
  term?: string | null;
  termSku?: string | null;
  testTransaction?: boolean;
}

function describeError(error: unknown): string {
  if (error instanceof ReceiptVerificationError) {
    return error.errorMessage;
  }
  const status = (error as { code?: unknown })?.code;
  const type = error instanceof Error ? error.name : typeof error;
  return typeof status === "number" ? `${type} ${status}` : type;
}

function isAbortError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function buildAmazonRvsUrl(args: {
  sharedSecret: string;
  userId: string;
  receiptId: string;
  sandbox: boolean;
}): string {
  const sandboxSegment = args.sandbox ? "/sandbox" : "";
  return (
    `${AMAZON_RVS_BASE_URL}${sandboxSegment}/version/${AMAZON_RVS_VERSION}` +
    `/verifyReceiptId/developer/${encodePathSegment(args.sharedSecret)}` +
    `/user/${encodePathSegment(args.userId)}` +
    `/receiptId/${encodePathSegment(args.receiptId)}`
  );
}

export function buildAmazonRemoteId(args: {
  userId: string;
  receiptId: string;
  sandbox: boolean;
}): string {
  return [
    args.sandbox ? "sandbox" : "production",
    encodePathSegment(args.userId),
    encodePathSegment(args.receiptId),
  ].join(":");
}

export function mapAmazonReceiptState(
  receipt: AmazonReceiptData,
): HarmonizedPurchaseState {
  if (receipt.cancelDate !== undefined && receipt.cancelDate !== null) {
    return HarmonizedPurchaseState.CANCELED;
  }

  const productType = receipt.productType?.toUpperCase();
  switch (productType) {
    case "CONSUMABLE":
      return HarmonizedPurchaseState.READY_TO_CONSUME;
    case "ENTITLED":
      return HarmonizedPurchaseState.ENTITLED;
    case "SUBSCRIPTION":
      if (
        receipt.renewalDate !== undefined &&
        receipt.renewalDate !== null &&
        receipt.renewalDate < Date.now()
      ) {
        return HarmonizedPurchaseState.EXPIRED;
      }
      return HarmonizedPurchaseState.ENTITLED;
    default:
      return HarmonizedPurchaseState.UNKNOWN;
  }
}

export function parseAmazonReceiptResponse(raw: unknown): AmazonReceiptData {
  if (!raw || typeof raw !== "object") {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned an unparseable body.",
    );
  }

  return raw;
}

function parseAmazonJsonBody(bodyText: string): unknown {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned an empty body.",
      { responseBody: "" },
    );
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    throw new AmazonReceiptVerificationError(
      "Amazon RVS returned invalid JSON.",
      {
        parseError:
          error instanceof Error ? error.message : describeError(error),
        responseBody: bodyText.slice(0, 2_048),
      },
    );
  }
}

export const verifyAmazonReceiptInternalV1 = action({
  args: {
    apiKey: v.string(),
    userId: v.string(),
    receiptId: v.string(),
    sandbox: v.optional(v.boolean()),
    requestIp: v.optional(v.string()),
  },
  returns: receiptResponseValidator,
  handler: async (ctx, args) => {
    const verificationStart = Date.now();
    const project = await getProjectByApiKey(ctx, args.apiKey);
    const sandbox = args.sandbox === true;
    const sharedSecret = project.amazonSharedSecret?.trim();

    if (!sandbox && !sharedSecret) {
      throw new AmazonSharedSecretNotConfiguredError();
    }

    const requestData = {
      store: "amazon" as const,
      userId: args.userId,
      receiptId: args.receiptId,
      sandbox,
    };
    const applicationId = project.androidPackageName ?? "amazon-appstore";
    const remoteId = buildAmazonRemoteId({
      userId: args.userId,
      receiptId: args.receiptId,
      sandbox,
    });
    const url = buildAmazonRvsUrl({
      sharedSecret: sharedSecret || AMAZON_SANDBOX_SHARED_SECRET,
      userId: args.userId,
      receiptId: args.receiptId,
      sandbox,
    });

    const saveFailedReceipt = async (failure: {
      error: string;
      message: string;
      details?: unknown;
      state?: HarmonizedPurchaseState;
    }) => {
      await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
        projectId: project._id,
        store: "amazon",
        applicationId,
        remoteId,
        requestData,
        remoteResponse: JSON.stringify({
          error: failure.error,
          message: failure.message,
          details: failure.details ?? null,
        }),
        state: failure.state ?? HarmonizedPurchaseState.UNKNOWN,
        isValid: false,
        requestIp: args.requestIp,
        verificationDurationMs: Date.now() - verificationStart,
      });
    };

    let parsedBody: unknown;
    try {
      parsedBody = await retryOnTransient(
        async () => {
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(),
            AMAZON_RVS_FETCH_TIMEOUT_MS,
          );
          const res = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          }).finally(() => clearTimeout(timeout));
          const bodyText = await res.text().catch(() => "");

          if (res.status === 400 || res.status === 497) {
            throw new AmazonReceiptInvalidError(
              res.status,
              bodyText.slice(0, 512) ||
                (res.status === 497 ? "invalid user ID" : "invalid receipt"),
            );
          }
          if (res.status === 410) {
            throw new AmazonReceiptInvalidError(
              res.status,
              bodyText.slice(0, 512) || "receipt is no longer valid",
            );
          }
          if (res.status === 496) {
            throw new AmazonReceiptVerificationError("invalid shared secret");
          }
          if (!res.ok) {
            const err = new Error(
              `Amazon RVS ${res.status}: ${bodyText.slice(0, 512)}`,
            );
            (err as { code?: number }).code = res.status;
            throw err;
          }

          return parseAmazonJsonBody(bodyText);
        },
        {
          shouldRetry: (error) =>
            isAbortError(error) ||
            extractHttpStatus(error) === 429 ||
            isTransientHttpError(error),
        },
      );
    } catch (error) {
      if (error instanceof AmazonReceiptInvalidError) {
        const state =
          error.errorDetails?.status === 410
            ? HarmonizedPurchaseState.CANCELED
            : HarmonizedPurchaseState.INAUTHENTIC;
        await saveFailedReceipt({
          error: error.errorCode,
          message: error.errorMessage,
          details: error.errorDetails ?? null,
          state,
        });
        return { isValid: false, state };
      }

      const message = describeError(error);
      await saveFailedReceipt({
        error:
          error instanceof ReceiptVerificationError
            ? error.errorCode
            : "AMAZON_RECEIPT_VERIFICATION_ERROR",
        message,
        details:
          error instanceof ReceiptVerificationError
            ? error.errorDetails
            : undefined,
      });
      throw new AmazonReceiptVerificationError(message);
    }

    let receiptData: AmazonReceiptData;
    let state: HarmonizedPurchaseState;
    let remoteResponse: string;
    try {
      receiptData = parseAmazonReceiptResponse(parsedBody);
      state = mapAmazonReceiptState(receiptData);
      remoteResponse = JSON.stringify(receiptData);
    } catch (error) {
      const message = describeError(error);
      await saveFailedReceipt({
        error: "AMAZON_RECEIPT_PARSE_ERROR",
        message,
        details: {
          rawResponse: parsedBody,
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      throw new AmazonReceiptVerificationError(message);
    }

    await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
      projectId: project._id,
      store: "amazon",
      applicationId,
      remoteId,
      requestData,
      remoteResponse,
      state,
      isValid: isValidState(state),
      requestIp: args.requestIp,
      verificationDurationMs: Date.now() - verificationStart,
    });

    return {
      isValid: isValidState(state),
      state,
      ...(receiptData.productId ? { productId: receiptData.productId } : {}),
    };
  },
});

export { ReceiptVerificationError };
