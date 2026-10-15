"use node";

// "Re-sync from store": an admin re-read of Apple or Google, saved through the
// verification save path and `resync.ts`. One or two store calls finish well
// inside an action, so it runs inline against its own admission bucket rather
// than as a job.

import {
  APIException,
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  type JWSRenewalInfoDecodedPayload,
  type LastTransactionsItem,
} from "@apple/app-store-server-library";
import type { FunctionReturnType } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { loadAppleRootCertificates } from "../certificates/apple_root_certificates";
import { selectAppleSubscriptionItem } from "../orders/shared";
import {
  mapSubscriptionResponseToReceiptData,
  playPublisher,
  verifyPurchaseWithGooglePlay,
} from "../purchases/android";
import {
  isPlayStoreTokenNoLongerValidError,
  PlayStorePurchaseNotFoundError,
  PlayStorePurchaseVerificationFailedError,
  ReceiptVerificationError,
} from "../purchases/errors";
import {
  assertVerifiedTransactionBinding,
  getAppStoreServerCredentials,
  verifyJWSTransaction,
} from "../purchases/ios";
import { extractHttpStatus, retryOnTransient } from "../purchases/retry";
import {
  AppStoreProductType,
  mapToAppStoreReceiptResponse,
  mapToGooglePlayReceiptResponse,
  type AppStoreReceiptData,
  type GooglePlayReceiptData,
  type ReceiptResponse,
} from "../purchases/shared";
import { buildVerifiedSubscriptionSnapshot } from "./internal";
import {
  appleStatusSnapshot,
  purchaseResyncOutcomeValidator,
  resyncOutcomeValidator,
  type ResyncOutcome,
} from "./resync";

const resyncResultValidator = v.object({
  target: v.union(v.literal("purchase"), v.literal("subscription")),
  store: v.union(v.literal("apple"), v.literal("google")),
  purchase: v.optional(purchaseResyncOutcomeValidator),
  subscription: v.optional(resyncOutcomeValidator),
});
export type ResyncResult = Infer<typeof resyncResultValidator>;

type ResyncTarget = FunctionReturnType<
  typeof internal.subscriptions.resync.getResyncTarget
>;
type PurchaseTarget = Extract<ResyncTarget, { kind: "purchase" }>;

/** Owners, admins and secret keys; pass exactly one of the two ids. */
export const resyncFromStore = action({
  args: {
    projectId: v.optional(v.id("projects")),
    apiKey: v.optional(v.string()),
    purchaseId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
  returns: resyncResultValidator,
  handler: async (ctx, args): Promise<ResyncResult> => {
    if (
      (args.purchaseId === undefined) ===
      (args.subscriptionId === undefined)
    ) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Pass exactly one of purchaseId or subscriptionId.",
      });
    }
    const project: Doc<"projects"> = await ctx.runQuery(
      internal.projects.internal.getOperatorProject,
      { projectId: args.projectId, apiKey: args.apiKey, access: "write" },
    );
    return await resync(ctx, project, {
      purchaseId: args.purchaseId,
      subscriptionId: args.subscriptionId,
    });
  },
});

/**
 * Re-reads a subscription a verify disagreed with but could not prove newer
 * than its last re-sync. It draws on the same bucket and gives up quietly.
 */
export const resyncDisputedSubscription = internalAction({
  args: { projectId: v.id("projects"), subscriptionId: v.id("subscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project: Doc<"projects"> | null = await ctx.runQuery(
      internal.projects.internal.getProjectById,
      { projectId: args.projectId },
    );
    if (!project) return null;
    try {
      await resync(ctx, project, { subscriptionId: args.subscriptionId });
    } catch (error) {
      console.warn(
        "[resync] disputed verify not re-read: %s",
        error instanceof Error ? error.name : typeof error,
      );
    }
    return null;
  },
});

async function resync(
  ctx: ActionCtx,
  project: Doc<"projects">,
  ids: { purchaseId?: string; subscriptionId?: string },
): Promise<ResyncResult> {
  const target: ResyncTarget = await ctx.runQuery(
    internal.subscriptions.resync.getResyncTarget,
    { projectId: project._id, ...ids },
  );
  await ctx.runMutation(internal.purchases.verificationAdmission.consume, {
    projectId: project._id,
    bucket: "storeResync",
  });
  return target.store === "apple"
    ? await resyncApple(ctx, project, target)
    : await resyncGoogle(ctx, project, target);
}

function savePurchaseVerdict(
  ctx: ActionCtx,
  project: Doc<"projects">,
  target: PurchaseTarget,
  verdict: {
    applicationId: string;
    remoteResponse: string;
    response: ReceiptResponse;
    observedAt: number;
  },
): Promise<NonNullable<ResyncResult["purchase"]>> {
  return ctx.runMutation(internal.subscriptions.resync.applyPurchaseResync, {
    projectId: project._id,
    purchaseId: target.purchaseId,
    observedAt: verdict.observedAt,
    applicationId: verdict.applicationId,
    remoteResponse: verdict.remoteResponse,
    state: verdict.response.state,
    isValid: verdict.response.isValid,
  });
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

async function resyncApple(
  ctx: ActionCtx,
  project: Doc<"projects">,
  target: ResyncTarget,
): Promise<ResyncResult> {
  const bundleId = project.iosBundleId;
  if (!bundleId) {
    throw new ConvexError({
      code: "IOS_NOT_CONFIGURED",
      message: "Set the App Store bundle ID in Settings before re-syncing.",
    });
  }
  const credentials = await getAppStoreServerCredentials(ctx, project);
  const apple: AppleApi = {
    bundleId,
    appAppleId: project.iosAppAppleId,
    clientFor: (environment) =>
      new AppStoreServerAPIClient(
        credentials.privateKey,
        credentials.keyId,
        credentials.issuerId,
        bundleId,
        environment,
      ),
  };

  if (target.kind === "subscription") {
    const observed = await fetchAppleStatus(
      apple,
      target.purchaseToken,
      target.environment,
    );
    return {
      target: "subscription",
      store: "apple",
      subscription: await applyAppleStatus(ctx, project, observed),
    };
  }

  const stored = storedAppleTransaction(target);
  if (stored.type === AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION) {
    // A subscription row reflects its latest renewal, not the transaction the
    // client first verified, which may be periods old.
    const observed = await fetchAppleStatus(
      apple,
      stored.originalTransactionId,
      stored.environment,
    );
    const purchase = await savePurchaseVerdict(ctx, project, target, {
      applicationId: observed.transaction.bundleId ?? bundleId,
      remoteResponse: JSON.stringify(observed.transaction),
      response: mapToAppStoreReceiptResponse(observed.transaction),
      observedAt: observed.observedAt,
    });
    return {
      target: "purchase",
      store: "apple",
      purchase,
      subscription: await applyAppleStatus(ctx, project, observed),
    };
  }

  const observedAt = Date.now();
  const transaction = await withAppleEnvironment(
    apple,
    stored.environment,
    async (environment) => {
      const response = await retryOnTransient(() =>
        apple.clientFor(environment).getTransactionInfo(stored.transactionId),
      );
      if (!response.signedTransactionInfo) {
        throw new ConvexError({
          code: "STORE_REQUEST_FAILED",
          message: "The App Store returned no transaction for this purchase.",
        });
      }
      const verified = await verifyJWSTransaction(
        response.signedTransactionInfo,
        bundleId,
        environment,
        apple.appAppleId,
      );
      assertVerifiedTransactionBinding({
        requestedTransactionId: stored.transactionId,
        requestedEnvironment: environment,
        expectedBundleId: bundleId,
        verified,
      });
      return verified;
    },
  );
  return {
    target: "purchase",
    store: "apple",
    purchase: await savePurchaseVerdict(ctx, project, target, {
      applicationId: transaction.bundleId ?? bundleId,
      remoteResponse: JSON.stringify(transaction),
      response: mapToAppStoreReceiptResponse(transaction),
      observedAt,
    }),
  };
}

/** Ids from the stored, already-verified response; the JWS only as a fallback. */
function storedAppleTransaction(target: PurchaseTarget): {
  transactionId: string;
  originalTransactionId: string;
  type?: string;
  environment?: "Production" | "Sandbox";
} {
  const parsed = parseObject(target.remoteResponse);
  const claims =
    target.requestData.store === "apple"
      ? parseObject(jwsPayload(target.requestData.jws))
      : {};
  const pick = (key: string): string | undefined => {
    const value = parsed[key] ?? claims[key];
    return typeof value === "string" ? value : undefined;
  };
  const transactionId = pick("transactionId");
  if (!transactionId) {
    throw new ConvexError({
      code: "NOT_RESYNCABLE",
      message: "This purchase has no App Store transaction id to re-sync.",
    });
  }
  const environment = pick("environment");
  const type = pick("type");
  return {
    transactionId,
    originalTransactionId: pick("originalTransactionId") ?? transactionId,
    ...(type ? { type } : {}),
    ...(environment
      ? {
          environment: environment === "Production" ? "Production" : "Sandbox",
        }
      : {}),
  };
}

function jwsPayload(jws: string): string | undefined {
  const payload = jws.split(".")[1];
  return payload
    ? Buffer.from(payload, "base64url").toString("utf-8")
    : undefined;
}

function parseObject(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

type AppleApi = {
  bundleId: string;
  appAppleId: number | undefined;
  clientFor: (environment: Environment) => AppStoreServerAPIClient;
};

/**
 * Runs `request` in the known environment, or tries production then sandbox
 * when the row does not say, as Apple recommends for an unknown environment.
 */
export async function withAppleEnvironment<T>(
  apple: AppleApi,
  known: "Production" | "Sandbox" | undefined,
  request: (environment: Environment) => Promise<T>,
): Promise<T> {
  const environments =
    known === "Sandbox"
      ? [Environment.SANDBOX]
      : known === "Production"
        ? [Environment.PRODUCTION]
        : [Environment.PRODUCTION, Environment.SANDBOX];
  for (const environment of environments) {
    // The signed-data verifier needs the App Apple ID in production.
    if (
      environment === Environment.PRODUCTION &&
      apple.appAppleId === undefined
    ) {
      if (known === "Production") {
        throw new ConvexError({
          code: "IOS_NOT_CONFIGURED",
          message:
            "Set the App Apple ID in Settings to re-sync production purchases.",
        });
      }
      continue;
    }
    try {
      return await request(environment);
    } catch (error) {
      const notFound =
        error instanceof APIException && error.httpStatusCode === 404;
      if (!notFound) throw appleRequestError(error);
    }
  }
  throw new ConvexError({
    code: "NOT_FOUND",
    message: "The App Store has no record of this transaction.",
  });
}

function appleRequestError(error: unknown): unknown {
  if (error instanceof ConvexError) return error;
  if (error instanceof APIException) {
    return new ConvexError({
      code: "STORE_REQUEST_FAILED",
      message: `App Store Server API returned HTTP ${String(error.httpStatusCode)}${
        error.errorMessage ? `: ${error.errorMessage}` : ""
      }`,
    });
  }
  return new ConvexError({
    code: "STORE_REQUEST_FAILED",
    message: "The App Store Server API request failed.",
  });
}

type AppleObservedStatus = {
  originalTransactionId: string;
  environment: "Production" | "Sandbox";
  status: number | undefined;
  transaction: AppStoreReceiptData;
  renewal: JWSRenewalInfoDecodedPayload | null;
  observedAt: number;
};

async function fetchAppleStatus(
  apple: AppleApi,
  originalTransactionId: string,
  known: "Production" | "Sandbox" | undefined,
): Promise<AppleObservedStatus> {
  return withAppleEnvironment(apple, known, async (environment) => {
    const observedAt = Date.now();
    const statuses = await retryOnTransient(() =>
      apple
        .clientFor(environment)
        .getAllSubscriptionStatuses(originalTransactionId),
    );
    const item: LastTransactionsItem | undefined = selectAppleSubscriptionItem(
      statuses.data,
      [originalTransactionId],
    );
    if (!item?.signedTransactionInfo) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "The App Store has no subscription status for this purchase.",
      });
    }
    const transaction = await verifyJWSTransaction(
      item.signedTransactionInfo,
      apple.bundleId,
      environment,
      apple.appAppleId,
    );
    // Fetched from Apple over TLS; the chain is still checked offline.
    const renewal = item.signedRenewalInfo
      ? await new SignedDataVerifier(
          loadAppleRootCertificates(),
          false,
          environment,
          apple.bundleId,
          apple.appAppleId,
        ).verifyAndDecodeRenewalInfo(item.signedRenewalInfo)
      : null;
    return {
      originalTransactionId,
      environment: transaction.environment,
      status: item.status,
      transaction,
      renewal,
      observedAt,
    };
  });
}

async function applyAppleStatus(
  ctx: ActionCtx,
  project: Doc<"projects">,
  observed: AppleObservedStatus,
): Promise<ResyncOutcome> {
  const snapshot = appleStatusSnapshot({
    status: observed.status,
    transaction: observed.transaction,
    renewal: observed.renewal,
  });
  if (!snapshot) {
    throw new ConvexError({
      code: "STORE_REQUEST_FAILED",
      message: `The App Store reported subscription status ${String(observed.status)}, which IAPKit does not map.`,
    });
  }
  return await ctx.runMutation(internal.subscriptions.resync.applyStoreResync, {
    projectId: project._id,
    platform: "IOS",
    store: "apple",
    purchaseToken: observed.originalTransactionId,
    observedAt: observed.observedAt,
    snapshot,
    context: {
      environment: observed.environment,
      ...(observed.transaction.bundleId
        ? { applicationId: observed.transaction.bundleId }
        : {}),
      ...(observed.transaction.transactionId
        ? { transactionId: observed.transaction.transactionId }
        : {}),
      originalTransactionId: observed.originalTransactionId,
    },
  });
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

async function resyncGoogle(
  ctx: ActionCtx,
  project: Doc<"projects">,
  target: ResyncTarget,
): Promise<ResyncResult> {
  const packageName = project.androidPackageName;
  if (!packageName) {
    throw new ConvexError({
      code: "ANDROID_NOT_CONFIGURED",
      message: "Set the Android package name in Settings before re-syncing.",
    });
  }
  const androidpublisher = await playPublisher(ctx, project._id);
  if (typeof androidpublisher === "string") {
    throw new ConvexError({
      code: "GOOGLE_SERVICE_ACCOUNT_REQUIRED",
      message: "Upload the Play service-account key in Settings to re-sync.",
    });
  }

  if (target.kind === "subscription") {
    const observedAt = Date.now();
    const response = await retryOnTransient(() =>
      androidpublisher.purchases.subscriptionsv2.get({
        packageName,
        token: target.purchaseToken,
      }),
    ).catch((error: unknown) => {
      throw googleRequestError(error);
    });
    const receiptData = mapSubscriptionResponseToReceiptData({
      packageName,
      purchaseToken: target.purchaseToken,
      subscriptionResponse: response.data,
      expectedProductId: target.productId,
    });
    return {
      target: "subscription",
      store: "google",
      subscription: await applyGoogleSubscription(
        ctx,
        project,
        receiptData,
        mapToGooglePlayReceiptResponse(receiptData),
        observedAt,
      ),
    };
  }

  if (target.requestData.store !== "google") {
    throw new ConvexError({
      code: "NOT_RESYNCABLE",
      message: "This purchase has no Google Play token to re-sync.",
    });
  }
  const observedAt = Date.now();
  const { receiptData, remoteResponse } = await readGooglePurchase(
    androidpublisher,
    {
      packageName,
      purchaseToken: target.requestData.purchaseToken,
      expectedProductId:
        target.requestData.expectedProductId ?? target.productId,
    },
  );
  // Same catalog consult as verification, so consumables keep their state.
  const catalogProductType =
    receiptData.type === "InApp"
      ? await ctx.runQuery(internal.products.sync.getExistingProductType, {
          projectId: project._id,
          platform: "Android",
          productId: receiptData.productId,
        })
      : null;
  const response = mapToGooglePlayReceiptResponse(
    receiptData,
    catalogProductType,
  );
  const purchase = await savePurchaseVerdict(ctx, project, target, {
    applicationId: receiptData.packageName,
    remoteResponse,
    response,
    observedAt,
  });
  return {
    target: "purchase",
    store: "google",
    purchase,
    ...(receiptData.type === "Subscription"
      ? {
          subscription: await applyGoogleSubscription(
            ctx,
            project,
            receiptData,
            response,
            observedAt,
          ),
        }
      : {}),
  };
}

async function applyGoogleSubscription(
  ctx: ActionCtx,
  project: Doc<"projects">,
  receiptData: GooglePlayReceiptData,
  response: ReceiptResponse,
  observedAt: number,
): Promise<ResyncOutcome> {
  const snapshot = buildVerifiedSubscriptionSnapshot({
    platform: "Android",
    productId: receiptData.productId,
    purchaseState: response.state,
    subscriptionState: receiptData.subscriptionState,
    expiresAt: receiptData.expiryTime,
    renewsAt: receiptData.renewsAt,
    willRenew: receiptData.willRenew,
    currency: receiptData.currency,
    priceAmountMicros: receiptData.priceAmountMicros,
  });
  if (!snapshot) {
    throw new ConvexError({
      code: "STORE_REQUEST_FAILED",
      message: "Google Play returned no product for this subscription.",
    });
  }
  return await ctx.runMutation(internal.subscriptions.resync.applyStoreResync, {
    projectId: project._id,
    platform: "Android",
    store: "google",
    purchaseToken: receiptData.purchaseToken,
    observedAt,
    snapshot,
    context: {
      environment: receiptData.environment ?? "Production",
      applicationId: receiptData.packageName,
    },
  });
}

/** The purchase lookup verify uses, failing with the subscription path's codes. */
export async function readGooglePurchase(
  ...args: Parameters<typeof verifyPurchaseWithGooglePlay>
): ReturnType<typeof verifyPurchaseWithGooglePlay> {
  try {
    return await verifyPurchaseWithGooglePlay(...args);
  } catch (error) {
    throw googleRequestError(error);
  }
}

function googleStatus(error: unknown): number | undefined {
  if (error instanceof PlayStorePurchaseNotFoundError) return 404;
  if (error instanceof PlayStorePurchaseVerificationFailedError) {
    if (isPlayStoreTokenNoLongerValidError(error)) return 410;
    const status = error.errorDetails?.status;
    return typeof status === "number" ? status : undefined;
  }
  return error instanceof ReceiptVerificationError
    ? undefined
    : extractHttpStatus(error);
}

function googleRequestError(error: unknown): ConvexError<{
  code: string;
  message: string;
}> {
  const status = googleStatus(error);
  const gone = status === 404 || status === 410;
  // googleapis error text, kept in `details.originalError`, can echo the
  // request URL with the token, so only IAPKit's own message is reported.
  return new ConvexError({
    code: gone ? "NOT_FOUND" : "STORE_REQUEST_FAILED",
    message: gone
      ? "Google Play no longer knows this token (revoked, or expired over 60 days ago)."
      : error instanceof ReceiptVerificationError
        ? error.errorMessage
        : `Google Play request failed${status ? ` (HTTP ${status})` : ""}.`,
  });
}
