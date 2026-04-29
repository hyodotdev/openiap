"use node";

import { action, ActionCtx } from "../_generated/server";
import { google } from "googleapis";
import { androidpublisher_v3 } from "googleapis";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import {
  getProjectByApiKey,
  mapToGooglePlayReceiptResponse,
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

// Google Play receipt verification action
export const verifyGooglePlayReceiptInternalV1 = action({
  args: {
    apiKey: v.string(),
    purchaseToken: v.string(),
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

    let requestData = {
      store: "google" as const,
      purchaseToken: args.purchaseToken,
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
        });

      requestData = {
        store: "google" as const,
        purchaseToken: args.purchaseToken,
      };

      const receiptResponse = mapToGooglePlayReceiptResponse(receiptData);

      await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
        projectId: project._id,
        store: "google",
        applicationId: receiptData.packageName,
        remoteId: receiptData.purchaseToken,
        requestData,
        remoteResponse,
        state: receiptResponse.state,
        isValid: isValidState(receiptResponse.state),
        requestIp: args.requestIp,
        verificationDurationMs: Date.now() - verificationStart,
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

      console.error("Error verifying Android purchase:", error);
      throw new PlayStoreVerificationError(error);
    }
  },
});

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

function parseAndValidateServiceAccountKey(
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
    keyData.private_key = keyData.private_key.replace(/\\n/g, "\n");

    return keyData;
  } catch (parseError) {
    console.error("Failed to parse service account key:", parseError);
    throw new InvalidServiceAccountKeyFormatError();
  }
}

type GooglePlayVerificationResult = {
  receiptData: GooglePlayReceiptData;
  remoteResponse: string;
};

function parseTimeToMillis(time?: string | null): number | undefined {
  if (!time) {
    return undefined;
  }

  const asNumber = Number(time);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  const parsed = Date.parse(time);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function mapSubscriptionResponseToReceiptData(args: {
  packageName: string;
  purchaseToken: string;
  subscriptionResponse: androidpublisher_v3.Schema$SubscriptionPurchaseV2;
}): GooglePlayReceiptData {
  const lineItem = args.subscriptionResponse.lineItems?.[0];
  const purchaseDate =
    parseTimeToMillis(args.subscriptionResponse.startTime) ?? Date.now();
  const expiryTime = parseTimeToMillis(lineItem?.expiryTime);
  const productId = lineItem?.productId || "unknown";

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
  };
}

export function mapProductResponseToReceiptData(args: {
  packageName: string;
  purchaseToken: string;
  productResponse: androidpublisher_v3.Schema$ProductPurchaseV2;
}): GooglePlayReceiptData {
  const lineItem = args.productResponse.productLineItem?.[0];
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
      lineItem?.productOfferDetails?.consumptionState ||
      args.productResponse.productLineItem?.[0]?.productOfferDetails
        ?.consumptionState ||
      undefined,
  };
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
      const errorMessage =
        subscriptionError instanceof Error
          ? subscriptionError.message
          : String(subscriptionError);
      console.error("Subscription verification also failed:", errorMessage);
      console.error("Error details:", subscriptionError);

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
