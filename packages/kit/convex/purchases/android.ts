"use node";

import { action, ActionCtx } from "../_generated/server";
import { google } from "googleapis";
import { androidpublisher_v3 } from "googleapis";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { moneyToMicros } from "../products/play";
import {
  getProjectByApiKey,
  mapToGooglePlayReceiptResponse,
  applyExpectedProductId,
  GooglePlayReceiptData,
  receiptResponseValidator,
  isValidState,
} from "./shared";
import {
  PlayStoreServiceAccountNotFoundError,
  PlayStoreFileContentNotReadableError,
  InvalidServiceAccountKeyFormatError,
  InvalidServiceAccountTypeError,
  ServiceAccountPrivateKeyMissingError,
  ServiceAccountClientEmailMissingError,
  ServiceAccountProjectIdMissingError,
  createPlayStoreError,
  PlayStoreVerificationError,
  ProjectAndroidPackageNameNotConfiguredError,
  PlayStorePurchaseNotFoundError,
  PlayStorePurchaseVerificationFailedError,
  isPlayStoreTokenNoLongerValidError,
  isPlayStorePackageNameMismatchError,
} from "./errors";
import { ReceiptVerificationError } from "./errors";
import { HarmonizedPurchaseState } from "./purchaseState";
import { retryOnTransient } from "./retry";

function describeError(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

// Google Play receipt verification action
export const verifyGooglePlayReceiptInternalV1 = action({
  args: {
    apiKey: v.string(),
    purchaseToken: v.string(),
    expectedProductId: v.optional(v.string()),
    requestIp: v.optional(v.string()),
  },
  returns: receiptResponseValidator,
  handler: async (ctx, args) => {
    const verificationStart = Date.now();
    const project = await getProjectByApiKey(ctx, args.apiKey);
    const packageName = project.androidPackageName;

    if (!packageName) {
      throw new ProjectAndroidPackageNameNotConfiguredError();
    }

    const serviceAccountFile = await ctx.runQuery(
      internal.files.internal.getGooglePlayFileByProjectInternal,
      {
        projectId: project._id,
      },
    );

    if (!serviceAccountFile) {
      throw new PlayStoreServiceAccountNotFoundError();
    }

    const fileContent = await ctx.runAction(
      internal.files.internal.readFileAsText,
      {
        fileId: serviceAccountFile._id,
      },
    );

    if (!fileContent || !fileContent.content) {
      throw new PlayStoreFileContentNotReadableError();
    }

    const keyData = parseAndValidateServiceAccountKey(fileContent.content);

    const requestData: {
      store: "google";
      purchaseToken: string;
      expectedProductId?: string;
    } = {
      store: "google" as const,
      purchaseToken: args.purchaseToken,
      ...(args.expectedProductId !== undefined
        ? { expectedProductId: args.expectedProductId }
        : {}),
    };

    try {
      const auth = new google.auth.GoogleAuth({
        credentials: keyData,
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
      });

      const androidpublisher = google.androidpublisher({
        version: "v3",
        auth,
      });

      const { receiptData, remoteResponse } =
        await verifyPurchaseWithGooglePlay(androidpublisher, {
          packageName,
          purchaseToken: args.purchaseToken,
          expectedProductId: args.expectedProductId,
        });

      // The Play API cannot mark an inapp purchase as consumable, so consult
      // the project's synced catalog to map unconsumed consumables to
      // READY_TO_CONSUME instead of a PENDING_ACKNOWLEDGMENT the standard
      // verify-then-finish client flow can never clear.
      const catalogProductType =
        receiptData.type === "InApp"
          ? await ctx.runQuery(internal.products.sync.getExistingProductType, {
              projectId: project._id,
              platform: "Android",
              productId: receiptData.productId,
            })
          : null;

      // Persist the store-verified purchase state; `expectedProductId`
      // mismatch is caller-scoped and should not corrupt purchase logs.
      const storeReceiptResponse = mapToGooglePlayReceiptResponse(
        receiptData,
        catalogProductType,
      );
      const receiptResponse = applyExpectedProductId(
        storeReceiptResponse,
        args.expectedProductId,
      );

      await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
        projectId: project._id,
        store: "google",
        applicationId: receiptData.packageName,
        remoteId: receiptData.purchaseToken,
        requestData,
        remoteResponse,
        state: storeReceiptResponse.state,
        isValid: isValidState(storeReceiptResponse.state),
        requestIp: args.requestIp,
        verificationDurationMs: Date.now() - verificationStart,
      });
      await recordGooglePlayVerifiedSubscription(ctx, {
        projectId: project._id,
        receiptData,
        purchaseState: storeReceiptResponse.state,
      });

      return receiptResponse;
    } catch (error) {
      const verificationDurationMs = Date.now() - verificationStart;

      const buildFailedReceiptParams = (
        receiptError: ReceiptVerificationError,
      ) => ({
        projectId: project._id,
        packageName,
        purchaseToken: args.purchaseToken,
        remoteResponse: JSON.stringify(
          receiptError.errorDetails ?? {
            errorCode: receiptError.errorCode,
            message: receiptError.errorMessage,
            details: receiptError.errorDetails ?? null,
          },
        ),
        requestData,
        requestIp: args.requestIp,
        error: receiptError,
        verificationDurationMs,
      });

      if (
        error instanceof PlayStorePurchaseVerificationFailedError &&
        isPlayStorePackageNameMismatchError(error)
      ) {
        const harmonizedState = HarmonizedPurchaseState.INAUTHENTIC;

        await persistFailedGoogleReceipt(ctx, {
          ...buildFailedReceiptParams(error),
          state: harmonizedState,
        });

        return {
          isValid: false,
          state: harmonizedState,
        };
      }

      if (
        error instanceof PlayStorePurchaseVerificationFailedError &&
        // This is a special case. Google returns error 410 with this message
        // When a subscription is not found. It returns the same error for subscriptions
        // that have previously been found but expired 60 days ago. We currently
        // have no way to differentiate between the two situations.
        isPlayStoreTokenNoLongerValidError(error)
      ) {
        const harmonizedState = HarmonizedPurchaseState.UNKNOWN;

        await persistFailedGoogleReceipt(ctx, {
          ...buildFailedReceiptParams(error),
          state: harmonizedState,
        });

        return {
          isValid: false,
          state: harmonizedState,
        };
      }

      if (
        error instanceof ReceiptVerificationError &&
        shouldPersistFailedGoogleReceipt(error)
      ) {
        await persistFailedGoogleReceipt(ctx, {
          ...buildFailedReceiptParams(error),
        });
      }

      console.error("Error verifying Android purchase:", describeError(error));
      throw new PlayStoreVerificationError(error);
    }
  },
});

export async function recordGooglePlayVerifiedSubscription(
  ctx: Pick<ActionCtx, "runMutation">,
  params: {
    projectId: Id<"projects">;
    receiptData: GooglePlayReceiptData;
    purchaseState: HarmonizedPurchaseState;
  },
): Promise<void> {
  if (params.receiptData.type !== "Subscription") return;

  await ctx.runMutation(
    internal.subscriptions.internal.recordVerifiedSubscription,
    {
      projectId: params.projectId,
      platform: "Android",
      purchaseToken: params.receiptData.purchaseToken,
      productId: params.receiptData.productId,
      purchaseState: params.purchaseState,
      subscriptionState: params.receiptData.subscriptionState,
      expiresAt: params.receiptData.expiryTime,
      renewsAt: params.receiptData.renewsAt,
      currency: params.receiptData.currency,
      priceAmountMicros: params.receiptData.priceAmountMicros,
    },
  );
}

interface GoogleServiceAccountKey {
  type: "service_account";
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}

export function parseAndValidateServiceAccountKey(
  content: string,
): GoogleServiceAccountKey {
  let keyData;

  try {
    keyData = JSON.parse(content);

    // Validate required fields
    if (!keyData.type || keyData.type !== "service_account") {
      throw new InvalidServiceAccountTypeError(keyData.type);
    }

    if (!keyData.private_key) {
      throw new ServiceAccountPrivateKeyMissingError();
    }

    if (!keyData.client_email) {
      throw new ServiceAccountClientEmailMissingError();
    }

    if (!keyData.project_id) {
      throw new ServiceAccountProjectIdMissingError();
    }

    // Check if private key is properly formatted
    if (
      !keyData.private_key.includes("BEGIN RSA PRIVATE KEY") &&
      !keyData.private_key.includes("BEGIN PRIVATE KEY")
    ) {
      console.error(
        "Private key format issue - may be corrupted or improperly escaped",
      );
    }

    // Ensure private key has proper line breaks. Always normalize any
    // literal `\n` escape sequences — a key that was JSON-encoded once
    // and then embedded in another JSON payload can contain a mix of
    // real newlines and escaped ones; the old "only-if-no-newlines"
    // guard left those mixed keys broken.
    keyData.private_key = keyData.private_key.replaceAll("\\n", "\n");

    return keyData;
  } catch (parseError) {
    console.error(
      "Failed to parse service account key:",
      describeError(parseError),
    );
    throw new InvalidServiceAccountKeyFormatError();
  }
}

type GooglePlayVerificationResult = {
  receiptData: GooglePlayReceiptData;
  remoteResponse: string;
};

export function parseTimeToMillis(time?: string | null): number | undefined {
  const value = time?.trim();
  if (!value) {
    return undefined;
  }

  if (/^\d+$/.test(value)) {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : undefined;
  }

  if (isNumericLikeTimestamp(value)) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isNumericLikeTimestamp(value: string): boolean {
  return (
    /^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value) ||
    /^0x[0-9a-f]+$/i.test(value)
  );
}

export function mapSubscriptionResponseToReceiptData(args: {
  packageName: string;
  purchaseToken: string;
  subscriptionResponse: androidpublisher_v3.Schema$SubscriptionPurchaseV2;
}): GooglePlayReceiptData {
  const lineItem = selectSubscriptionLineItem(
    args.subscriptionResponse.lineItems ?? [],
  );
  const purchaseDate =
    parseTimeToMillis(args.subscriptionResponse.startTime) ?? Date.now();
  const expiryTime = parseTimeToMillis(lineItem?.expiryTime);
  const productId = lineItem?.productId || "unknown";
  const recurringPrice = lineItem?.autoRenewingPlan?.recurringPrice;

  return {
    transactionId: args.purchaseToken,
    packageName: args.packageName,
    productId,
    purchaseToken: args.purchaseToken,
    purchaseDate,
    quantity: 1,
    type: "Subscription" as const,
    orderId:
      lineItem?.latestSuccessfulOrderId ||
      args.subscriptionResponse.latestOrderId ||
      undefined,
    subscriptionState: args.subscriptionResponse.subscriptionState || undefined,
    acknowledgementState:
      args.subscriptionResponse.acknowledgementState || undefined,
    expiryTime: expiryTime,
    renewsAt: lineItem?.autoRenewingPlan ? expiryTime : undefined,
    currency: recurringPrice?.currencyCode ?? undefined,
    priceAmountMicros: moneyToMicros(recurringPrice),
  };
}

function selectSubscriptionLineItem(
  lineItems: NonNullable<
    androidpublisher_v3.Schema$SubscriptionPurchaseV2["lineItems"]
  >,
): androidpublisher_v3.Schema$SubscriptionPurchaseLineItem | undefined {
  return (
    lineItems.reduce<
      androidpublisher_v3.Schema$SubscriptionPurchaseLineItem | undefined
    >((selected, candidate) => {
      if (!candidate.expiryTime) return selected;
      const score = Date.parse(candidate.expiryTime);
      if (!Number.isFinite(score)) return selected;
      const selectedScore = selected?.expiryTime
        ? Date.parse(selected.expiryTime)
        : -Infinity;
      return score > selectedScore ? candidate : selected;
    }, undefined) ?? lineItems[0]
  );
}

export function mapProductResponseToReceiptData(args: {
  packageName: string;
  purchaseToken: string;
  productResponse: androidpublisher_v3.Schema$ProductPurchaseV2;
  expectedProductId?: string;
}): GooglePlayReceiptData {
  const lineItem = selectProductLineItem(
    args.productResponse.productLineItem,
    args.expectedProductId,
  );
  const purchaseDate =
    parseTimeToMillis(args.productResponse.purchaseCompletionTime) ??
    Date.now();
  const productId = lineItem?.productId || "unknown";

  return {
    transactionId: args.purchaseToken,
    packageName: args.packageName,
    productId,
    purchaseToken: args.purchaseToken,
    purchaseDate,
    quantity: lineItem?.productOfferDetails?.quantity ?? 1,
    type: "InApp" as const,
    orderId: args.productResponse.orderId || undefined,
    purchaseState:
      args.productResponse.purchaseStateContext?.purchaseState || undefined,
    acknowledgementState:
      args.productResponse.acknowledgementState || undefined,
    consumptionState:
      lineItem?.productOfferDetails?.consumptionState || undefined,
  };
}

/**
 * Picks the line item a verification is about.
 *
 * Reading `productLineItem[0]` unconditionally is wrong once a token
 * covers more than one item — Play's newer one-time-product model lets a
 * single purchase carry several purchase options, and a multi-item token
 * would resolve to whichever item Google happened to list first. When
 * the caller told us which product it expects, honour that; otherwise
 * keep the historical first-item behaviour.
 */
export function selectProductLineItem(
  lineItems: androidpublisher_v3.Schema$ProductLineItem[] | undefined | null,
  expectedProductId?: string,
): androidpublisher_v3.Schema$ProductLineItem | undefined {
  if (!lineItems?.length) return undefined;
  if (expectedProductId) {
    const match = lineItems.find(
      (item) => item.productId === expectedProductId,
    );
    if (match) return match;
  }
  return lineItems[0];
}

/**
 * True when Google says it has never heard of this purchase token.
 *
 * Right after a purchase completes, `productsv2` / `subscriptionsv2` can
 * still 404 for a few hundred milliseconds — the write hasn't propagated
 * yet. Clients verify immediately (the reporter in issue #289 measured
 * t≈1s), so treating that 404 as final rejects a perfectly good purchase
 * the app then refuses to acknowledge, and Google voids it at ~301s.
 */
function isFreshTokenNotYetPropagated(error: unknown): boolean {
  return error instanceof PlayStorePurchaseNotFoundError;
}

export function isProductNotFoundError(error: unknown): boolean {
  if ((error as { code?: number } | null)?.code === 404) {
    return true;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return message.toLowerCase().includes("not found");
}

async function verifyPurchaseWithGooglePlay(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  args: {
    packageName: string;
    purchaseToken: string;
    expectedProductId?: string;
  },
): Promise<GooglePlayVerificationResult> {
  // Neither catalog knowing the token can simply mean the purchase is
  // seconds old and hasn't propagated yet, so retry the product →
  // subscription pair before calling it unknown (issue #289). Only the
  // "not found in either" outcome retries; auth, permission, and
  // package-mismatch errors still fail fast.
  return retryOnTransient(
    () => lookUpGooglePlayPurchase(androidpublisher, args),
    {
      shouldRetry: isFreshTokenNotYetPropagated,
      // ~2s of total backoff at worst. Cheap next to the alternative:
      // Google voids an unacknowledged purchase at ~301s, and the app
      // can't acknowledge what kit wouldn't verify.
      maxAttempts: 4,
      baseDelayMs: 300,
    },
  );
}

async function lookUpGooglePlayPurchase(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  args: {
    packageName: string;
    purchaseToken: string;
    expectedProductId?: string;
  },
): Promise<GooglePlayVerificationResult> {
  let receiptData: GooglePlayReceiptData;
  let remoteResponse: string = "null";

  try {
    // Verify in-app product purchase first. `retryOnTransient` wraps
    // the call so Google Play 5xx / network blips don't propagate as
    // customer-visible failures — but it deliberately leaves 4xx
    // responses (including 404 for "not a product purchase") alone so
    // the downstream branch below can fall through to the subscription
    // lookup on its first observation of the 404.
    const productResponse = await retryOnTransient(() =>
      androidpublisher.purchases.productsv2.getproductpurchasev2({
        packageName: args.packageName,
        token: args.purchaseToken,
      }),
    );

    if (!productResponse.data) {
      throw new PlayStorePurchaseNotFoundError();
    }

    receiptData = mapProductResponseToReceiptData({
      packageName: args.packageName,
      purchaseToken: args.purchaseToken,
      productResponse: productResponse.data,
      expectedProductId: args.expectedProductId,
    });

    remoteResponse = JSON.stringify(productResponse.data ?? null);
  } catch (productError) {
    // Only retry as a subscription when the product lookup failed because
    // the token wasn't a product purchase (404 / "not found"). Auth failures,
    // permission errors, and network errors should surface as-is instead of
    // issuing a second doomed request.
    if (!isProductNotFoundError(productError)) {
      throw createPlayStoreError(productError);
    }

    // If in-app purchase fails, try as a subscription. Same retry
    // policy applies — transient 5xx from Google Play's subscription
    // endpoint is not a reason to fail the customer's verify call.
    try {
      const subResponse = await retryOnTransient(() =>
        androidpublisher.purchases.subscriptionsv2.get({
          packageName: args.packageName,
          token: args.purchaseToken,
        }),
      );

      if (!subResponse.data) {
        throw new PlayStorePurchaseNotFoundError();
      }

      receiptData = mapSubscriptionResponseToReceiptData({
        packageName: args.packageName,
        purchaseToken: args.purchaseToken,
        subscriptionResponse: subResponse.data,
      });

      remoteResponse = JSON.stringify(subResponse.data ?? null);
    } catch (subscriptionError: unknown) {
      console.error(
        "Subscription verification also failed:",
        describeError(subscriptionError),
      );

      // Throw appropriate error based on the error type
      throw createPlayStoreError(subscriptionError);
    }
  }

  return { receiptData, remoteResponse };
}

function shouldPersistFailedGoogleReceipt(
  error: ReceiptVerificationError,
): boolean {
  return (
    error instanceof PlayStorePurchaseNotFoundError ||
    error instanceof PlayStorePurchaseVerificationFailedError
  );
}

async function persistFailedGoogleReceipt(
  ctx: ActionCtx,
  params: {
    projectId: Id<"projects">;
    packageName: string;
    purchaseToken: string;
    remoteResponse?: string;
    requestData: {
      store: "google";
      purchaseToken: string;
      expectedProductId?: string;
    };
    requestIp?: string;
    error: ReceiptVerificationError;
    verificationDurationMs?: number;
    state?: HarmonizedPurchaseState;
  },
) {
  await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
    projectId: params.projectId,
    store: "google",
    applicationId: params.packageName,
    remoteId: params.purchaseToken,
    requestData: params.requestData,
    remoteResponse:
      params.remoteResponse ??
      JSON.stringify({
        errorCode: params.error.errorCode,
        message: params.error.errorMessage,
        details: params.error.errorDetails ?? null,
      }),
    state: params.state ?? HarmonizedPurchaseState.INAUTHENTIC,
    isValid: false,
    requestIp: params.requestIp,
    verificationDurationMs: params.verificationDurationMs,
  });
}
