"use node";
import {
  Environment,
  SignedDataVerifier,
  type ResponseBodyV2DecodedPayload,
  type JWSTransactionDecodedPayload,
  type JWSRenewalInfoDecodedPayload,
} from "@apple/app-store-server-library";
import { ConvexError, v } from "convex/values";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { loadAppleRootCertificates } from "../certificates/apple_root_certificates";
import { getProjectByApiKey } from "../purchases/shared";
import {
  normalizeAppleAsn,
  WebhookNormalizationError,
  type AppleAsnPayload,
  type AppleDecodedTransaction,
  type AppleDecodedRenewalInfo,
} from "./shared";

type IngestResult = {
  eventId: Id<"webhookEvents">;
  type: string;
  deduped: boolean;
};

// Called from server/api/v1/webhooks.ts with the signedPayload from Apple's
// POST body and the project's API key. Apple retries a notificationUUID on
// transient 5xx; recordWebhookEvent dedups it and the route still returns 200.
//
// The IOS suffix follows knowledge/internal/01-naming-conventions.md even
// though "Apple" already implies iOS.
export const ingestAppleAsnIOS = action({
  args: {
    apiKey: v.string(),
    signedPayload: v.string(),
  },
  returns: v.object({
    eventId: v.id("webhookEvents"),
    type: v.string(),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args): Promise<IngestResult> => {
    const project = await getProjectByApiKey(ctx, args.apiKey);

    // Checked here, not in the route, to save a Convex round-trip.
    // mapWebhookError maps IOS_NOT_CONFIGURED to 412.
    const iosMissing: string[] = [];
    if (!project.iosBundleId) iosMissing.push("iosBundleId");
    if (!project.iosAppAppleId) iosMissing.push("iosAppAppleId");
    if (!project.iosAppStoreIssuerId) iosMissing.push("iosAppStoreIssuerId");
    if (!project.iosAppStoreKeyId) iosMissing.push("iosAppStoreKeyId");
    if (iosMissing.length > 0) {
      throw new ConvexError({
        code: "IOS_NOT_CONFIGURED",
        message: `Apple ASN v2 received but iOS is not configured for this project. Missing: ${iosMissing.join(", ")}.`,
      });
    }

    // Decode without verification to inspect environment + bundleId
    // before instantiating the verifier — the verifier requires the
    // environment up front.
    const previewPayload = previewDecodeNotification(args.signedPayload);

    if (
      project.iosBundleId &&
      previewPayload.data?.bundleId &&
      previewPayload.data.bundleId !== project.iosBundleId
    ) {
      // Permanent config error: mapWebhookError returns 400, since a 5xx
      // would make ASN retry.
      throw new ConvexError({
        code: "BUNDLE_ID_MISMATCH",
        message: `Bundle ID mismatch: notification ${previewPayload.data.bundleId} vs project ${project.iosBundleId}`,
      });
    }

    const environment = mapPreviewEnvironment(previewPayload.data?.environment);
    const appleRootCAs = loadAppleRootCertificates();
    const verifier = new SignedDataVerifier(
      appleRootCAs,
      // Online checks off: latency stays predictable, and an OCSP/CRL hiccup
      // would otherwise fail verification permanently instead of retrying.
      // The certificate chain is still validated offline.
      false,
      environment,
      project.iosBundleId ?? "",
      project.iosAppAppleId,
    );

    let payload: ResponseBodyV2DecodedPayload;
    try {
      payload = await verifier.verifyAndDecodeNotification(args.signedPayload);
    } catch (error) {
      console.error(
        "[webhooks/apple] notification verification failed",
        error instanceof Error ? error.name : typeof error,
      );
      // Permanent failure: mapWebhookError returns 400, per Apple's "do not
      // retry on permanent failure" guidance; a 5xx would be retried forever.
      throw new ConvexError({
        code: "INVALID_SIGNATURE",
        message: "Apple ASN v2 signature verification failed",
      });
    }

    // The inner transaction and renewal JWS are signed too, but the verified
    // outer payload already covers them, so they are only decoded.
    const transaction = decodeOptionalJws<JWSTransactionDecodedPayload>(
      payload.data?.signedTransactionInfo,
    );
    const renewalInfo = decodeOptionalJws<JWSRenewalInfoDecodedPayload>(
      payload.data?.signedRenewalInfo,
    );

    let normalized;
    try {
      normalized = normalizeAppleAsn({
        payload: toAppleAsnPayload(payload),
        transaction: toDecodedTransaction(transaction),
        renewalInfo: toDecodedRenewalInfo(renewalInfo),
      });
    } catch (error) {
      if (error instanceof WebhookNormalizationError) {
        // UnknownEventType means Apple shipped a type IAPKit doesn't map yet:
        // ACK it (200) so ASN stops retrying. The other codes mean a malformed
        // payload and return 400 so the operator notices; an ACK would lose it.
        if (error.code === "UnknownEventType") {
          console.warn(
            "[webhooks/apple] dropping unsupported notification",
            error.code,
            error.message,
          );
          throw new ConvexError({
            code: "UNSUPPORTED_EVENT",
            message: error.message,
          });
        }
        throw new ConvexError({
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }

    const result = await ctx.runMutation(
      internal.webhooks.internal.recordWebhookEvent,
      {
        projectId: project._id,
        source: "apple",
        sourceNotificationId: normalized.sourceNotificationId,
        event: {
          type: normalized.type,
          sourceFull: normalized.source,
          platform: normalized.platform,
          environment: normalized.environment,
          purchaseToken: normalized.purchaseToken,
          transactionId: normalized.transactionId,
          originalTransactionId: normalized.originalTransactionId,
          applicationId: normalized.applicationId,
          productKind: normalized.productKind,
          productId: normalized.productId,
          effectiveImmediately: normalized.effectiveImmediately,
          subscriptionState: normalized.subscriptionState,
          expiresAt: normalized.expiresAt,
          renewsAt: normalized.renewsAt,
          willRenew: normalized.willRenew,
          cancellationReason: normalized.cancellationReason,
          currency: normalized.currency,
          priceAmountMicros: normalized.priceAmountMicros,
          amountProvenance: normalized.amountProvenance,
          occurredAt: normalized.occurredAt,
          rawSignedPayload: args.signedPayload,
        },
      },
    );

    // Apply even when deduped: an earlier attempt may have recorded the event
    // and crashed before updating the subscription. The mutation records
    // webhookEvents.appliedAt atomically, so a replay is a no-op even after a
    // newer event replaced subscriptions.lastEventId.
    //
    // TestNotification has no purchaseToken. One-time purchases use the same
    // handler, which marks them applied without creating subscription state or
    // commerce events.
    if (normalized.purchaseToken) {
      await ctx.runMutation(
        internal.subscriptions.internal.applySubscriptionEvent,
        {
          projectId: project._id,
          eventId: result.eventId,
        },
      );
    }

    return {
      eventId: result.eventId,
      type: normalized.type,
      deduped: result.deduped,
    };
  },
});

// Decodes without verifying, to learn the environment SignedDataVerifier
// needs. Both failures are permanent input errors, thrown as ConvexErrors so
// mapWebhookError returns 400 instead of a 500 that Apple would retry.
function previewDecodeNotification(jws: string): {
  data?: { environment?: string; bundleId?: string };
} {
  const parts = jws.split(".");
  if (parts.length !== 3) {
    throw new ConvexError({
      code: "INVALID_SIGNATURE",
      message: "Apple notification is not a valid JWS",
    });
  }
  try {
    const decoded = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    );
    return decoded as { data?: { environment?: string; bundleId?: string } };
  } catch {
    throw new ConvexError({
      code: "INVALID_SIGNATURE",
      message: "Apple notification body is not valid JSON",
    });
  }
}

/**
 * Maps only to environments Apple signs. The value comes unverified, and
 * SignedDataVerifier skips verification under XCODE and LOCAL_TESTING, which
 * would let anyone with the publishable key POST an unsigned notification.
 */
export function mapPreviewEnvironment(value: string | undefined): Environment {
  return value === "Sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
}

function decodeOptionalJws<T>(jws: string | null | undefined): T | null {
  if (!jws) {
    return null;
  }
  const parts = jws.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    return JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8"),
    ) as T;
  } catch {
    return null;
  }
}

function toAppleAsnPayload(
  payload: ResponseBodyV2DecodedPayload,
): AppleAsnPayload {
  return {
    notificationType: String(payload.notificationType ?? ""),
    subtype: payload.subtype ? String(payload.subtype) : null,
    notificationUUID: payload.notificationUUID ?? "",
    signedDate: payload.signedDate ?? Date.now(),
    data: payload.data
      ? {
          environment: payload.data.environment ?? null,
          bundleId: payload.data.bundleId ?? null,
          appAppleId: payload.data.appAppleId ?? null,
          signedTransactionInfo: payload.data.signedTransactionInfo ?? null,
          signedRenewalInfo: payload.data.signedRenewalInfo ?? null,
        }
      : null,
  };
}

function toDecodedTransaction(
  transaction: JWSTransactionDecodedPayload | null,
): AppleDecodedTransaction | null {
  if (!transaction) {
    return null;
  }
  return {
    originalTransactionId: transaction.originalTransactionId ?? null,
    transactionId: transaction.transactionId ?? null,
    type: transaction.type ?? null,
    productId: transaction.productId ?? null,
    expiresDate: transaction.expiresDate ?? null,
    revocationReason: transaction.revocationReason ?? null,
    currency: transaction.currency ?? null,
    price: transaction.price ?? null,
  };
}

function toDecodedRenewalInfo(
  renewalInfo: JWSRenewalInfoDecodedPayload | null,
): AppleDecodedRenewalInfo | null {
  if (!renewalInfo) {
    return null;
  }
  return {
    autoRenewStatus: renewalInfo.autoRenewStatus ?? null,
    autoRenewProductId: renewalInfo.autoRenewProductId ?? null,
    expirationIntent: renewalInfo.expirationIntent ?? null,
    gracePeriodExpiresDate: renewalInfo.gracePeriodExpiresDate ?? null,
    isInBillingRetryPeriod: renewalInfo.isInBillingRetryPeriod ?? null,
    renewalDate: renewalInfo.renewalDate ?? null,
    currency: renewalInfo.currency ?? null,
    renewalPrice: renewalInfo.renewalPrice ?? null,
    recentSubscriptionStartDate:
      renewalInfo.recentSubscriptionStartDate ?? null,
  };
}
