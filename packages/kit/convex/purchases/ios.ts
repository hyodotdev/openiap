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
  getVerificationProjectByApiKey,
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
  isStoreOutage,
  STORE_OUTAGE_RETRY_AFTER_SEC,
} from "./errors";
import { retryOnTransient } from "./retry";
import { readAppleP8Key } from "../files/internal";
import { es256KeyProblem } from "../products/jwt";

function describeError(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
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
    const project = await getVerificationProjectByApiKey(ctx, args.apiKey);

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

    // A failed check stores nothing: a signature failure would let forged bytes
    // grow the table, and a Server API error is no verdict on a transaction
    // Apple already signed. Verdicts come from the store-verified path below.
    const serverCredentials = await getAppStoreServerCredentials(ctx, project);

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

    const transactionData = await verifyTransactionWithServerApi({
      ctx,
      decodedJwsPayload: decodedPayload,
      bundleId: project.iosBundleId,
      environment,
      appAppleId: project.iosAppAppleId,
      credentials: serverCredentials,
    });

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
  // Non-renewing passes carry no expiry, so a subscription row would stay
  // entitled forever; they remain purchases, as on the webhook path.
  if (
    params.transactionData.type !==
    AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION
  ) {
    return;
  }

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
      verifiedPurchaseDate: params.transactionData.purchaseDate,
      verifiedSignedDate: params.transactionData.signedDate,
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

    // Online checks call Apple's CRL/OCSP endpoints, so transient failures
    // retry, as on the other store paths. The type adds fields a StoreKit 2
    // device JWS carries but the server library omits.
    const verifiedTransaction: JWSTransactionDecodedPayload & {
      gracePeriodExpiresDate?: number;
      deviceVerification?: string;
      deviceVerificationNonce?: string;
    } = await retryOnTransient(() => verifier.verifyAndDecodeTransaction(jws), {
      shouldRetry: isVerifierOutage,
    });

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
      gracePeriodExpiresDate: verifiedTransaction.gracePeriodExpiresDate,
      revocationDate: verifiedTransaction.revocationDate,
      revocationReason: verifiedTransaction.revocationReason,
      deviceVerification: verifiedTransaction.deviceVerification,
      deviceVerificationNonce: verifiedTransaction.deviceVerificationNonce,
      inAppOwnershipType: verifiedTransaction.inAppOwnershipType,
      signedDate: verifiedTransaction.signedDate,
      transactionReason: verifiedTransaction.transactionReason,
      appTransactionId: verifiedTransaction.appTransactionId,
    };

    return transactionData;
  } catch (error) {
    console.error("Error verifying JWS transaction:", describeError(error));
    throw new AppStoreTransactionVerificationFailedError(
      getVerificationErrorMessage(error),
      isVerifierOutage(error) ? STORE_OUTAGE_RETRY_AFTER_SEC : undefined,
    );
  }
}

// The verifier's only network call is the OCSP check, made after the chain
// verified against Apple's roots, so a failed request (node-fetch FetchError)
// or an unreadable reply such as a 503 page (raised in checkOCSPStatus) is an
// outage. A forged signature fails elsewhere and stays a verdict.
export function isVerifierOutage(error: unknown): boolean {
  if (!(error instanceof VerificationException)) return false;
  const cause = error.cause;
  return (
    isFetchFailure(cause) ||
    (cause instanceof Error && (cause.stack ?? "").includes("checkOCSPStatus"))
  );
}

// node-fetch raises FetchError when a request gets no usable answer.
function isFetchFailure(error: unknown): boolean {
  return error instanceof Error && error.name === "FetchError";
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

  let privateKey: string | null = null;
  try {
    privateKey = await readAppleP8Key(
      ctx,
      project._id,
      "apple_p8_key",
      project.iosAppStoreKeyId,
    );
  } catch (error) {
    console.error("Failed to load Apple P8 key:", describeError(error));
  }
  // The Server API client signs before any request, so a key that cannot sign
  // ES256 is a configuration error, never an outage.
  if (!privateKey || es256KeyProblem(privateKey)) {
    missingFields.push("privateKey");
  }

  if (missingFields.length > 0 || !privateKey) {
    throw new AppStoreServerCredentialsMissingError(missingFields);
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
    // Retries the API's transient 5xx; extractHttpStatus reads APIException's
    // httpStatusCode.
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
        isStoreOutage(error) ? STORE_OUTAGE_RETRY_AFTER_SEC : undefined,
      );
    }

    // Only a failed request is an outage; any other error would repeat. Neither
    // text is ours to return.
    const outage = isFetchFailure(error);
    throw new AppStoreTransactionVerificationFailedError(
      outage
        ? "App Store Server API did not respond"
        : "App Store Server API request failed",
      outage ? STORE_OUTAGE_RETRY_AFTER_SEC : undefined,
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

function hashJws(jws: string): string {
  return createHash("sha256").update(jws).digest("hex");
}
