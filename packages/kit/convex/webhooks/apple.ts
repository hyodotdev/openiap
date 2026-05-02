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

// HTTP receiver invoked from `server/api/v1/webhooks.ts`. The Hono
// route forwards Apple's POST body (a JSON envelope `{ signedPayload }`)
// and the project's API key.
//
// The action verifies the signedPayload with `SignedDataVerifier`,
// decodes the embedded transaction + renewal JWS, normalizes everything
// through `normalizeAppleAsn`, then calls the idempotent insert mutation.
// Apple retries the same notificationUUID on transient 5xx — that case
// is collapsed inside `recordWebhookEvent` (returns `deduped: true`)
// and the route still responds 200 so Apple stops retrying.
//
// Naming: follows the openiap iOS suffix convention
// (`knowledge/internal/01-naming-conventions.md`) — iOS-specific
// functions end in `IOS`. Even though "Apple" already implies iOS,
// the convention is mechanical and applies to every iOS-only entry
// point.
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

    // Decode without verification to inspect environment + bundleId
    // before instantiating the verifier — the verifier requires the
    // environment up front.
    const previewPayload = previewDecodeNotification(args.signedPayload);

    if (
      project.iosBundleId &&
      previewPayload.data?.bundleId &&
      previewPayload.data.bundleId !== project.iosBundleId
    ) {
      // ConvexError so the Hono layer's `mapWebhookError` translates
      // this to a 400, not a 500. A bundle mismatch is a permanent
      // configuration error — Apple should NOT retry, and 5xx
      // triggers automatic retries from ASN that we don't want.
      throw new ConvexError({
        code: "BUNDLE_ID_MISMATCH",
        message: `Bundle ID mismatch: notification ${previewPayload.data.bundleId} vs project ${project.iosBundleId}`,
      });
    }

    const environment = mapPreviewEnvironment(previewPayload.data?.environment);
    const appleRootCAs = loadAppleRootCertificates();
    const verifier = new SignedDataVerifier(
      appleRootCAs,
      // `enableOnlineChecks: false` keeps webhook latency predictable —
      // ASN v2 retries on 5xx, but the same OCSP/CRL hiccup that breaks
      // a verifyAndDecodeNotification call would be a permanent
      // failure here. We still validate the certificate chain offline.
      false,
      environment,
      project.iosBundleId ?? "",
      project.iosAppAppleId,
    );

    let payload: ResponseBodyV2DecodedPayload;
    try {
      payload = await verifier.verifyAndDecodeNotification(args.signedPayload);
    } catch (error) {
      console.error("[webhooks/apple] notification verification failed", error);
      // ConvexError so the Hono `mapWebhookError` translates to 400 —
      // signature failure is a permanent error and a 5xx would trigger
      // ASN's automatic retry loop forever. Apple's "do not retry on
      // permanent failure" guidance maps cleanly to 4xx status codes.
      throw new ConvexError({
        code: "INVALID_SIGNATURE",
        message: "Apple ASN v2 signature verification failed",
      });
    }

    // Decode transaction + renewal JWS if present. Apple sends them
    // signed individually inside the outer payload; verifying them is
    // optional for ingestion since the outer signature already attests
    // to their integrity. We still parse to extract structured fields.
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
        // Selective handling: only `UnknownEventType` is "Apple ships
        // new types ahead of openiap spec" — those we ACK as 200 so
        // ASN v2 stops retrying. `MissingNotificationId` and
        // `MissingPurchaseToken` mean the payload itself is malformed
        // — those must surface as 400 so the operator notices, and
        // ACK-ing them silently would lose data.
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
          productId: normalized.productId,
          subscriptionState: normalized.subscriptionState,
          expiresAt: normalized.expiresAt,
          renewsAt: normalized.renewsAt,
          cancellationReason: normalized.cancellationReason,
          currency: normalized.currency,
          priceAmountMicros: normalized.priceAmountMicros,
          occurredAt: normalized.occurredAt,
          rawSignedPayload: args.signedPayload,
        },
      },
    );

    // Always run applySubscriptionEvent — the mutation is idempotent
    // against `lastEventId`, so a no-op when the row is already at
    // this eventId is cheap. Skipping on dedup looked tidy in
    // telemetry but left the subscription stranded if the previous
    // attempt recorded the event then crashed before patching the
    // subscription row, since every Apple retry would dedup before
    // ever reaching the state mutation.
    await ctx.runMutation(
      internal.subscriptions.internal.applySubscriptionEvent,
      {
        projectId: project._id,
        eventId: result.eventId,
        event: {
          type: normalized.type,
          productId: normalized.productId,
          subscriptionState: normalized.subscriptionState,
          expiresAt: normalized.expiresAt,
          renewsAt: normalized.renewsAt,
          cancellationReason: normalized.cancellationReason,
          currency: normalized.currency,
          priceAmountMicros: normalized.priceAmountMicros,
          platform: normalized.platform,
          purchaseToken: normalized.purchaseToken,
        },
      },
    );

    return {
      eventId: result.eventId,
      type: normalized.type,
      deduped: result.deduped,
    };
  },
});

// Decode JWS payload without signature verification. Used pre-verifier
// to discover the environment so we can instantiate SignedDataVerifier
// with the correct value.
//
// Both failure modes (wrong shape, malformed body) are permanent input
// errors — Apple should NOT retry them, so we throw structured
// ConvexErrors that `mapWebhookError` will translate to 400 instead of
// the generic 500 a plain `Error` would produce.
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

function mapPreviewEnvironment(value: string | undefined): Environment {
  switch (value) {
    case "Sandbox":
      return Environment.SANDBOX;
    case "Xcode":
      return Environment.XCODE;
    default:
      return Environment.PRODUCTION;
  }
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
    recentSubscriptionStartDate:
      renewalInfo.recentSubscriptionStartDate ?? null,
  };
}
