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
  AppStoreReceiptData,
  receiptResponseValidator,
  isValidState,
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

export const verifyAppStoreReceiptInternalV1 = action({
  args: {
    apiKey: v.string(),
    jws: v.string(),
    requestIp: v.optional(v.string()),
  },
  returns: receiptResponseValidator,
  handler: async (ctx, args) => {
    const verificationStart = Date.now();
    const project = await getProjectByApiKey(ctx, args.apiKey);

    const decodedPayload = decodeJwsPayload(args.jws);
    const environment = decodedPayload.environment as Environment;

    const requestData = {
      store: "apple" as const,
      jws: args.jws,
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

    const remoteId =
      transactionData.originalTransactionId ||
      transactionData.transactionId ||
      hashJws(args.jws);

    const serializedResponse = JSON.stringify(transactionData);
    const receiptResponse = mapToAppStoreReceiptResponse(transactionData);

    await ctx.runMutation(internal.purchases.internal.saveReceiptInternal, {
      projectId: project._id,
      store: "apple",
      applicationId: transactionData.bundleId ?? project.iosBundleId,
      remoteId,
      requestData,
      remoteResponse: serializedResponse,
      state: receiptResponse.state,
      isValid: isValidState(receiptResponse.state),
      requestIp: args.requestIp,
      verificationDurationMs: Date.now() - verificationStart,
    });

    return receiptResponse;
  },
});

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

async function verifyJWSTransaction(
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

    const verifiedTransaction = await verifier.verifyAndDecodeTransaction(jws);

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
      environment: verifiedTransaction.environment as "Sandbox" | "Production",
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
    console.error("Error verifying JWS transaction:", error);
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

async function getAppStoreServerCredentials(
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
    console.error("Failed to load Apple P8 key:", error);
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
    const response = await client.getTransactionInfo(
      decodedJwsPayload.transactionId as string,
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
    environment: payload.environment as "Sandbox" | "Production",
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
