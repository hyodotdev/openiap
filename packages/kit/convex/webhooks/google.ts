"use node";
import { v } from "convex/values";
import { google } from "googleapis";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getProjectByApiKey } from "../purchases/shared";
import {
  normalizeGoogleRtdn,
  WebhookNormalizationError,
  type GoogleRtdnPayload,
  type GoogleSubscriptionInfo,
} from "./shared";

type IngestResult = {
  eventId: Id<"webhookEvents">;
  type: string;
  deduped: boolean;
};

// HTTP receiver invoked from `server/api/v1/webhooks.ts` after the
// route layer has verified the Pub/Sub push OIDC token.
//
// The action expects the *parsed* RTDN body — the route is responsible
// for base64-decoding `message.data` and shaping it into our
// GoogleRtdnPayload. From here we optionally enrich with a fetch to
// `androidpublisher.purchases.subscriptionsv2.get` (needs the project's
// service-account JSON) and then call the idempotent insert mutation.
//
// At-least-once Pub/Sub delivery means we'll see duplicate `messageId`s
// on retries; `recordWebhookEvent` collapses those into `deduped: true`.
export const ingestGoogleRtdn = action({
  args: {
    apiKey: v.string(),
    rawMessage: v.string(),
    payload: v.object({
      messageId: v.string(),
      packageName: v.optional(v.string()),
      eventTimeMillis: v.number(),
      subscriptionNotification: v.optional(
        v.object({
          notificationType: v.number(),
          purchaseToken: v.string(),
          subscriptionId: v.string(),
        }),
      ),
      oneTimeProductNotification: v.optional(
        v.object({
          notificationType: v.number(),
          purchaseToken: v.string(),
          sku: v.string(),
        }),
      ),
      voidedPurchaseNotification: v.optional(
        v.object({
          purchaseToken: v.string(),
          orderId: v.optional(v.string()),
          productType: v.optional(v.number()),
          refundType: v.optional(v.number()),
        }),
      ),
      testNotification: v.optional(v.object({ version: v.string() })),
    }),
  },
  returns: v.object({
    eventId: v.id("webhookEvents"),
    type: v.string(),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args): Promise<IngestResult> => {
    const project = await getProjectByApiKey(ctx, args.apiKey);

    if (
      project.androidPackageName &&
      args.payload.packageName &&
      args.payload.packageName !== project.androidPackageName
    ) {
      throw new Error(
        `Package name mismatch: notification ${args.payload.packageName} vs project ${project.androidPackageName}`,
      );
    }

    const subscriptionInfo = await maybeFetchSubscriptionInfo(
      ctx,
      project._id,
      project.androidPackageName,
      args.payload,
    );

    let normalized;
    try {
      normalized = normalizeGoogleRtdn({
        payload: args.payload as GoogleRtdnPayload,
        subscriptionInfo,
      });
    } catch (error) {
      if (error instanceof WebhookNormalizationError) {
        console.warn(
          "[webhooks/google] dropping unsupported notification",
          error.code,
          error.message,
        );
        throw new Error(`UNSUPPORTED_EVENT: ${error.message}`);
      }
      throw error;
    }

    const result = await ctx.runMutation(
      internal.webhooks.internal.recordWebhookEvent,
      {
        projectId: project._id,
        source: "google",
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
          rawSignedPayload: args.rawMessage,
        },
      },
    );

    if (!result.deduped) {
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
    }

    return {
      eventId: result.eventId,
      type: normalized.type,
      deduped: result.deduped,
    };
  },
});

// Best-effort enrichment with subscriptionsv2.get. Returns null when:
// - the project has no Play service account configured (the event
//   still flows through with type-derived state),
// - the notification is one-time / voided / test (no subscription to
//   look up),
// - or the API call fails. We deliberately swallow the failure rather
//   than hard-fail the webhook: kit's authoritative state can be
//   reconciled later via `verifyReceipt`.
async function maybeFetchSubscriptionInfo(
  ctx: { runAction: any; runQuery: any },
  projectId: unknown,
  packageName: string | undefined,
  payload: GoogleRtdnPayload,
): Promise<GoogleSubscriptionInfo | null> {
  if (!payload.subscriptionNotification || !packageName) {
    return null;
  }

  try {
    const serviceAccountFile = await ctx.runQuery(
      internal.files.internal.getGooglePlayFileByProjectInternal,
      { projectId },
    );
    if (!serviceAccountFile) {
      return null;
    }
    const fileContent = await ctx.runAction(
      internal.files.internal.readFileAsText,
      { fileId: serviceAccountFile._id },
    );
    if (!fileContent?.content) {
      return null;
    }
    const credentials = JSON.parse(fileContent.content);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const androidpublisher = google.androidpublisher({ version: "v3", auth });

    const response = await androidpublisher.purchases.subscriptionsv2.get({
      packageName,
      token: payload.subscriptionNotification.purchaseToken,
    });

    const data = response.data;
    const expiry =
      data.lineItems?.[0]?.expiryTime ??
      // Fallback: pre-v2 format had `expiryTimeMillis` at the root.
      undefined;
    const renews = data.lineItems?.[0]?.autoRenewingPlan?.recurringPrice
      ? data.lineItems?.[0]?.expiryTime
      : undefined;
    const recurring = data.lineItems?.[0]?.autoRenewingPlan?.recurringPrice;

    return {
      state: data.subscriptionState ?? undefined,
      cancelReason: data.canceledStateContext?.userInitiatedCancellation
        ? "USER_CANCELED"
        : data.canceledStateContext?.systemInitiatedCancellation
          ? "SYSTEM_INITIATED_CANCELLATION"
          : undefined,
      expiryTimeMillis: expiry ? Date.parse(expiry) : undefined,
      autoRenewingPlanRenewsTimeMillis: renews ? Date.parse(renews) : undefined,
      currency: recurring?.currencyCode ?? undefined,
      priceAmountMicros: recurring?.units
        ? // `units` is BigInt-as-string, `nanos` is the fractional part.
          // Combine to micros: units * 1_000_000 + nanos / 1_000.
          Number(recurring.units) * 1_000_000 +
          Math.round((recurring.nanos ?? 0) / 1_000)
        : undefined,
    };
  } catch (error) {
    console.warn(
      "[webhooks/google] subscriptionsv2 fetch failed; falling back to type-derived state",
      error,
    );
    return null;
  }
}
