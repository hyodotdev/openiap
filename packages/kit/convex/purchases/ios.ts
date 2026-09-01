"use node";
import { createHash } from "node:crypto";
import {
  AppStoreServerAPIClient,
  SignedDataVerifier,
  Environment,
  VerificationException,
  type JWSTransactionDecodedPayload,
  VerificationStatus,
  APIException,
} from "@apple/app-store-server-library";
import { v } from "convex/values";

import { action, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { loadAppleRootCertificates } from "../certificates/apple_root_certificates";
import {
  getProjectByApiKey,
  mapToAppStoreReceiptResponse,
  applyExpectedProductId,
  AppStoreReceiptData,
  AppStoreProductType,
  receiptResponseValidator,
  isValidState,
  narrowAppleEnvironment,
} from "./shared";
import { HarmonizedPurchaseState } from "./purchaseState";
import {
  AppStoreInvalidJWSFormatError,
  AppStoreTransactionVerificationFailedError,
  ProjectAppStoreBundleIdNotConfiguredError,
  ProjectAppStoreAppleIdNotConfiguredError,
  AppStoreBundleIdMismatchError,
  AppStoreServerCredentialsMissingError,
  AppStoreServerCredentialField,
} from "./errors";
import { retryOnTransient } from "./retry";

function describeError(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function isAppStoreSubscriptionType(type: string | undefined): boolean {
  if (
    type === AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION ||
    type === AppStoreProductType.NON_RENEWING_SUBSCRIPTION
  ) {
    return true;
  }
  return type?.toLowerCase().includes("subscription") ?? false;
}

function appStorePriceToMicros(price: number | undefined): number | undefined {
  if (typeof price !== "number" || !Number.isFinite(price)) return undefined;
  // Apple transaction `price` is in milliunits; kit stores micros.
  return price * 1000;
}

export const verifyAppStoreReceiptInternalV1 = action({
  args: {
    apiKey: v.string(),
    jws: v.string(),
    expectedProductId: v.optional(v.string()),
    requestIp: v.optional(v.string()),
  },
  returns: receiptResponseValidator,
  handler: async (ctx, args) => {
    const verificationStart = Date.now();
    const project = await getProjectByApiKey(ctx, args.apiKey);

    const decodedPayload = decodeJwsPayload(args.jws);
    // The payload is decoded, not verified, so its environment must never
    // select a value that turns verification off: SignedDataVerifier returns
    // the decoded JWT unverified under XCODE and LOCAL_TESTING. Only the two
    // environments Apple actually signs are reachable.
    const environment =
      decodedPayload.environment === Environment.SANDBOX
        ? Environment.SANDBOX
        : Environment.PRODUCTION;

    const requestData: {
      store: "apple";
      jws: string;
      expectedProductId?: string;
    } = {
      store: "apple" as const,
      jws: args.jws,
      ...(args.expectedProductId !== undefined
        ? { expectedProductId: args.expectedProductId }
        : {}),
    };

    if (project.iosBundleId === undefined) {
      throw new ProjectAppStoreBundleIdNotConfiguredError();
    }

    if (
      environment === Environment.PRODUCTION &&
      project.iosAppAppleId === undefined
    ) {
      throw new ProjectAppStoreAppleIdNotConfiguredError();
    }

    if (decodedPayload.bundleId !== project.iosBundleId) {
      throw new AppStoreBundleIdMismatchError(
        project.iosBundleId,
        decodedPayload.bundleId as string,
      );
    }

    let transactionData: AppStoreReceiptData;

    try {
      const serverCredentials = await getAppStoreServerCredentials(
        ctx,
        project,
      );

      // Prove the caller holds an Apple-signed transaction before asking the
      // App Store about it. Without this, `decodeJwsPayload` above accepts any
      // base64 the caller assembles, and every downstream check compares
      // Apple's answer to the caller's own request — so knowing a
      // transactionId would be enough to obtain a verified verdict.
      await verifyJWSTransaction(
        args.jws,
        project.iosBundleId,
        environment,
        project.iosAppAppleId,
      );

      transactionData = await verifyTransactionWithServerApi({
        ctx,
        decodedJwsPayload: decodedPayload,
        bundleId: project.iosBundleId,
        environment,
        appAppleId: project.iosAppAppleId,
        credentials: serverCredentials,
      });
    } catch (error) {
      await persistFailedAppStoreReceipt(ctx, {
        projectId: project._id,
        bundleId: project.iosBundleId,
        jws: args.jws,
        requestData,
        requestIp: args.requestIp,
        error,
        verificationDurationMs: Date.now() - verificationStart,
      });
      throw error;
    }

    assertVerifiedTransactionBinding({
      requestedTransactionId: decodedPayload.transactionId,
      requestedEnvironment: environment,
      expectedBundleId: project.iosBundleId,
      verified: transactionData,
    });

    const remoteId =
      transactionData.originalTransactionId ||
      transactionData.transactionId ||
      hashJws(args.jws);

    const serializedResponse = JSON.stringify(transactionData);
    // Persist the store-verified purchase state; `expectedProductId`
    // mismatch is caller-scoped and should not corrupt purchase logs.
    const storeReceiptResponse = mapToAppStoreReceiptResponse(transactionData);
    const receiptResponse = applyExpectedProductId(
      storeReceiptResponse,
      args.expectedProductId,
    );

    await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
      projectId: project._id,
      store: "apple",
      applicationId: transactionData.bundleId ?? project.iosBundleId,
      remoteId,
      requestData,
      remoteResponse: serializedResponse,
      state: storeReceiptResponse.state,
      isValid: isValidState(storeReceiptResponse.state),
      requestIp: args.requestIp,
      verificationDurationMs: Date.now() - verificationStart,
    });
    await recordAppStoreVerifiedSubscription(ctx, {
      projectId: project._id,
      remoteId,
      transactionData,
      purchaseState: storeReceiptResponse.state,
    });

    return receiptResponse;
  },
});

export async function recordAppStoreVerifiedSubscription(
  ctx: Pick<ActionCtx, "runMutation">,
  params: {
    projectId: Id<"projects">;
    remoteId: string;
    transactionData: AppStoreReceiptData;
    purchaseState: HarmonizedPurchaseState;
  },
): Promise<void> {
  if (!isAppStoreSubscriptionType(params.transactionData.type)) return;

  await ctx.runMutation(
    internal.subscriptions.internal.recordVerifiedSubscription,
    {
      projectId: params.projectId,
      platform: "IOS",
      purchaseToken: params.remoteId,
      productId: params.transactionData.productId ?? "unknown",
      purchaseState: params.purchaseState,
      expiresAt: params.transactionData.expiresDate,
      currency: params.transactionData.currency,
      priceAmountMicros: appStorePriceToMicros(params.transactionData.price),
      revocationReasonIOS: params.transactionData.revocationReason,
    },
  );
}

function decodeJwsPayload(jws: string): JWSTransactionDecodedPayload {
  const parts = jws.split(".");

  if (parts.length !== 3) {
    throw new AppStoreInvalidJWSFormatError();
  }

  try {
    const [, payloadBase64] = parts;
    const decoded = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8"),
    );

    if (
      !(
        "environment" in decoded ||
        "transactionId" in decoded ||
        "bundleId" in decoded
      )
    ) {
      throw new AppStoreInvalidJWSFormatError();
    }

    return decoded as JWSTransactionDecodedPayload;
  } catch {
    throw new AppStoreInvalidJWSFormatError();
  }
}

export async function verifyJWSTransaction(
  jws: string,
  bundleId: string,
  environment: Environment,
  appAppleId?: number,
): Promise<AppStoreReceiptData> {
  try {
    const appleRootCAs = loadAppleRootCertificates();
    const enableOnlineChecks = true;

    const verifier = new SignedDataVerifier(
      appleRootCAs,
      enableOnlineChecks,
      environment,
      bundleId,
      appAppleId,
    );

    // `enableOnlineChecks: true` makes verifyAndDecodeTransaction
    // perform an HTTP call against Apple's CRL/OCSP endpoints, so a
    // transient Apple-edge 5xx or DNS hiccup would otherwise bubble
    // up as a permanent verification failure. Retry-on-transient
    // matches the policy the Server API + Google Play paths use.
    const verifiedTransaction = await retryOnTransient(() =>
      verifier.verifyAndDecodeTransaction(jws),
    );

    const transactionData = {
      transactionId: verifiedTransaction.transactionId,
      originalTransactionId: verifiedTransaction.originalTransactionId,
      bundleId: verifiedTransaction.bundleId,
      productId: verifiedTransaction.productId,
      purchaseDate: verifiedTransaction.purchaseDate,
      originalPurchaseDate: verifiedTransaction.originalPurchaseDate,
      quantity: verifiedTransaction.quantity,
      type: verifiedTransaction.type,
      price: verifiedTransaction.price,
      currency: verifiedTransaction.currency,
      storefront: verifiedTransaction.storefront,
      storefrontId: verifiedTransaction.storefrontId,
      environment: narrowAppleEnvironment(verifiedTransaction.environment),
      webOrderLineItemId: verifiedTransaction.webOrderLineItemId,
      subscriptionGroupIdentifier:
        verifiedTransaction.subscriptionGroupIdentifier,
      expiresDate: verifiedTransaction.expiresDate,
      gracePeriodExpiresDate: (verifiedTransaction as any)
        .gracePeriodExpiresDate,
      revocationDate: verifiedTransaction.revocationDate,
      revocationReason: verifiedTransaction.revocationReason,
      deviceVerification: (verifiedTransaction as any).deviceVerification,
      deviceVerificationNonce: (verifiedTransaction as any)
        .deviceVerificationNonce,
      inAppOwnershipType: verifiedTransaction.inAppOwnershipType,
      signedDate: verifiedTransaction.signedDate,
      transactionReason: verifiedTransaction.transactionReason,
      appTransactionId: (verifiedTransaction as any).appTransactionId,
    };

    return transactionData;
  } catch (error) {
    console.error("Error verifying JWS transaction:", describeError(error));
    throw new AppStoreTransactionVerificationFailedError(
      getVerificationErrorMessage(error),
    );
  }
}

type AppStoreServerCredentials = {
  issuerId: string;
  keyId: string;
  privateKey: string;
};

export async function getAppStoreServerCredentials(
  ctx: ActionCtx,
  project: Doc<"projects">,
): Promise<AppStoreServerCredentials> {
  const missingFields: AppStoreServerCredentialField[] = [];

  if (!project.iosAppStoreIssuerId) {
    missingFields.push("issuerId");
  }

  if (!project.iosAppStoreKeyId) {
    missingFields.push("keyId");
  }

  let privateKey: string | undefined;
  try {
    const keyResponse = await ctx.runAction(
      internal.files.internal.getAppleP8Key,
      {
        organizationId: project.organizationId,
        projectId: project._id,
      },
    );
    privateKey = keyResponse.keyContent;
  } catch (error) {
    console.error("Failed to load Apple P8 key:", describeError(error));
    missingFields.push("privateKey");
  }

  if (!privateKey && !missingFields.includes("privateKey")) {
    missingFields.push("privateKey");
  }

  if (missingFields.length > 0) {
    throw new AppStoreServerCredentialsMissingError(missingFields);
  }

  if (!privateKey) {
    // Should not happen because we track missingFields, but guard defensively.
    throw new AppStoreServerCredentialsMissingError(["privateKey"]);
  }

  return {
    issuerId: project.iosAppStoreIssuerId!,
    keyId: project.iosAppStoreKeyId!,
    privateKey,
  };
}

// The device JWS is decode-only (its claims are attacker-writable); Apple's
// response is what SignedDataVerifier proves. Reject any drift between the
// two so a tampered payload cannot select another transaction's verdict.
export function assertVerifiedTransactionBinding(params: {
  requestedTransactionId: unknown;
  requestedEnvironment: string;
  expectedBundleId: string;
  verified: Pick<
    AppStoreReceiptData,
    "transactionId" | "bundleId" | "environment"
  >;
}): void {
  const { requestedTransactionId, requestedEnvironment, expectedBundleId } =
    params;
  const verified = params.verified;

  if (verified.transactionId !== requestedTransactionId) {
    throw new AppStoreTransactionVerificationFailedError(
      `verified transactionId ${String(verified.transactionId)} does not match the requested ${String(requestedTransactionId)}`,
    );
  }

  if (verified.bundleId !== expectedBundleId) {
    throw new AppStoreTransactionVerificationFailedError(
      `verified bundleId ${String(verified.bundleId)} does not match the project's ${expectedBundleId}`,
    );
  }

  if (verified.environment !== requestedEnvironment) {
    throw new AppStoreTransactionVerificationFailedError(
      `verified environment ${String(verified.environment)} does not match the requested ${requestedEnvironment}`,
    );
  }
}

async function verifyTransactionWithServerApi(params: {
  ctx: ActionCtx;
  decodedJwsPayload: JWSTransactionDecodedPayload;
  bundleId: string;
  environment: Environment;
  appAppleId?: number;
  credentials: AppStoreServerCredentials;
}): Promise<AppStoreReceiptData> {
  const { decodedJwsPayload, bundleId, environment, appAppleId, credentials } =
    params;

  const client = new AppStoreServerAPIClient(
    credentials.privateKey,
    credentials.keyId,
    credentials.issuerId,
    bundleId,
    environment,
  );

  try {
    // App Store Server API can return transient 5xx during incidents;
    // retry matches the shared policy (max 3 attempts, sub-second
    // backoff, 4xx fails fast). `extractHttpStatus` reads
    // `httpStatusCode` from APIException so retry-on-5xx fires here.
    const response = await retryOnTransient(() =>
      client.getTransactionInfo(decodedJwsPayload.transactionId as string),
    );

    if (!response.signedTransactionInfo) {
      throw new AppStoreTransactionVerificationFailedError(
        "Missing signed transaction info from App Store Server API",
      );
    }

    return await verifyJWSTransaction(
      response.signedTransactionInfo,
      bundleId,
      environment,
      appAppleId,
    );
  } catch (error) {
    if (error instanceof AppStoreTransactionVerificationFailedError) {
      throw error;
    }

    if (error instanceof APIException) {
      throw new AppStoreTransactionVerificationFailedError(
        formatAppStoreServerApiError(error),
      );
    }

    throw new AppStoreTransactionVerificationFailedError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function formatAppStoreServerApiError(error: APIException): string {
  const status = error.httpStatusCode;

  const hints: Record<number, string> = {
    401: "Unauthorized. Verify the Issuer ID, Key ID, and .p8 key belong to the App Store Connect account for this bundle.",
    403: "Forbidden. Confirm the API key has access to this bundle and you're targeting the correct environment (sandbox vs production).",
    404: "Transaction not found. Double-check the transaction ID belongs to this app/environment.",
  };

  const hint = status ? hints[status] : undefined;
  const reason =
    error.errorMessage ??
    error.message ??
    (status ? `HTTP ${status}` : "Unknown error");

  const parts = [`App Store Server API error`];
  if (status) {
    parts.push(`(HTTP ${status})`);
  } else {
    parts.push("(unknown status)");
  }

  if (error.apiError) {
    parts.push(`code ${error.apiError}`);
  }

  parts.push(`: ${reason}`);
  if (hint) {
    parts.push(`– ${hint}`);
  }

  return parts.join(" ");
}

function getVerificationErrorMessage(error: unknown): string {
  if (error instanceof VerificationException) {
    if (error.cause !== undefined) {
      return error.cause.message;
    }

    switch (error.status) {
      case VerificationStatus.OK:
        return "Ok";
      case VerificationStatus.VERIFICATION_FAILURE:
        return "Verification failed";
      case VerificationStatus.INVALID_APP_IDENTIFIER:
        return "Invalid app identifier";
      case VerificationStatus.INVALID_ENVIRONMENT:
        return "Invalid enrivonment";
      case VerificationStatus.INVALID_CHAIN_LENGTH:
        return "Invalid chain length";
      case VerificationStatus.INVALID_CERTIFICATE:
        return "Invalid certificate";
      case VerificationStatus.FAILURE:
        return "Failure";
    }
  }

  return "Unknown verification error";
}

async function persistFailedAppStoreReceipt(
  ctx: ActionCtx,
  params: {
    projectId: Id<"projects">;
    bundleId: string;
    jws: string;
    requestData: {
      store: "apple";
      jws: string;
      expectedProductId?: string;
    };
    requestIp?: string;
    error: unknown;
    verificationDurationMs?: number;
  },
) {
  if (!shouldPersistFailedAppStoreReceipt(params.error)) {
    return;
  }

  const receiptData = buildFailedAppStoreReceiptData(
    params.jws,
    params.bundleId,
    params.error,
  );
  const remoteId =
    receiptData.originalTransactionId ||
    receiptData.transactionId ||
    hashJws(params.jws);

  await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
    projectId: params.projectId,
    store: "apple",
    applicationId: params.bundleId,
    remoteId,
    requestData: params.requestData,
    remoteResponse: JSON.stringify(receiptData),
    state: HarmonizedPurchaseState.INAUTHENTIC,
    isValid: false,
    requestIp: params.requestIp,
    verificationDurationMs: params.verificationDurationMs,
  });
}

function shouldPersistFailedAppStoreReceipt(
  error: unknown,
): error is AppStoreTransactionVerificationFailedError {
  return error instanceof AppStoreTransactionVerificationFailedError;
}

function buildFailedAppStoreReceiptData(
  jws: string,
  fallbackBundleId: string,
  error: AppStoreTransactionVerificationFailedError,
): AppStoreReceiptData & {
  failureReason: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
} {
  const payload = decodeJwsPayload(jws) ?? {};
  const now = Date.now();
  const transactionId =
    payload.transactionId || payload.originalTransactionId || hashJws(jws);
  const originalTransactionId = payload.originalTransactionId || transactionId;

  return {
    transactionId,
    originalTransactionId,
    bundleId: payload.bundleId ?? fallbackBundleId,
    productId: payload.productId ?? "unknown",
    purchaseDate:
      typeof payload.purchaseDate === "number" ? payload.purchaseDate : now,
    originalPurchaseDate:
      typeof payload.originalPurchaseDate === "number"
        ? payload.originalPurchaseDate
        : now,
    quantity:
      typeof payload.quantity === "number" && payload.quantity > 0
        ? payload.quantity
        : 1,
    type: payload.type,
    price: payload.price,
    currency: payload.currency,
    storefront: payload.storefront,
    storefrontId: payload.storefrontId,
    environment: narrowAppleEnvironment(payload.environment),
    webOrderLineItemId: payload.webOrderLineItemId,
    subscriptionGroupIdentifier: payload.subscriptionGroupIdentifier,
    expiresDate: payload.expiresDate,
    revocationDate: payload.revocationDate,
    revocationReason: payload.revocationReason,
    inAppOwnershipType: payload.inAppOwnershipType,
    signedDate: payload.signedDate,
    transactionReason: payload.transactionReason,
    appTransactionId: payload.appTransactionId,
    failureReason: {
      code: error.errorCode,
      message: error.errorMessage,
      details: error.errorDetails,
    },
  };
}

function hashJws(jws: string): string {
  return createHash("sha256").update(jws).digest("hex");
}
