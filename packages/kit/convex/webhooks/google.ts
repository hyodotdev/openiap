"use node";
import { ConvexError, v } from "convex/values";
import { google, type androidpublisher_v3 } from "googleapis";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { moneyToMicros } from "../products/play";
import { getProjectByApiKey } from "../purchases/shared";
import {
  normalizeGoogleRtdn,
  WebhookNormalizationError,
  type GoogleRtdnPayload,
  type GoogleSubscriptionInfo,
} from "./shared";

// Module-level cache for the Play Developer API client per project.
// Convex "use node" actions reuse the underlying process for warm
// starts — a fresh service-account fetch + JSON parse + GoogleAuth
// initialization on every webhook adds 50-200ms latency per
// notification and burns Convex storage I/O proportional to traffic.
// Caching the authenticated client survives across consecutive
// webhook invocations on the same machine; cold starts re-build it.
//
// TTL keeps the cache fresh enough that an operator-initiated
// service-account rotation reaches us within an hour without manual
// intervention — credentials don't change often, and a hung-on-old-
// key state would surface as Play API 401s on the affected webhooks
// (which then expire the cache via the catch path below).
const PLAY_CLIENT_TTL_MS = 60 * 60 * 1000;
const playClientCache = new Map<
  string,
  {
    client: androidpublisher_v3.Androidpublisher;
    expiresAt: number;
  }
>();

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

    // Setup-status gate. Previously the HTTP layer ran a separate
    // `getSetupStatus` query before invoking this action; inlining the
    // check here cuts the second Convex round-trip per webhook.
    // `mapWebhookError` translates "ANDROID_NOT_CONFIGURED" → 412 so
    // the operator sees the same structured error the prior pre-check
    // produced.
    if (!project.androidPackageName) {
      throw new ConvexError({
        code: "ANDROID_NOT_CONFIGURED",
        message:
          "Google RTDN received but Android is not configured for this project. Missing: androidPackageName.",
      });
    }

    if (
      project.androidPackageName &&
      args.payload.packageName &&
      args.payload.packageName !== project.androidPackageName
    ) {
      // Permanent input/config mismatch — Pub/Sub will retry forever
      // unless we surface this as a 4xx. ConvexError → mapWebhookError
      // → 400 so Google stops retrying a notification that can never
      // succeed against this project.
      throw new ConvexError({
        code: "PACKAGE_NAME_MISMATCH",
        message: `Package name mismatch: notification ${args.payload.packageName} vs project ${project.androidPackageName}`,
      });
    }

    // Pre-flight idempotency probe: if this messageId is already in
    // `webhookIdempotencyKeys`, this is a Pub/Sub redelivery for an
    // event we already processed. Short-circuit BEFORE
    // maybeFetchSubscriptionInfo so retries don't burn Play Developer
    // API quota on every redelivery — kit's webhook receiver becomes a
    // multiplier of Play API calls otherwise (one Pub/Sub retry per
    // outage minute → one Play API call per retry). The downstream
    // recordWebhookEvent + applySubscriptionEvent are still fully
    // idempotent, so this is purely a Play-quota / latency optimization.
    const preFlightEventId = await ctx.runQuery(
      internal.webhooks.internal.lookupExistingEvent,
      {
        projectId: project._id,
        source: "google",
        sourceNotificationId: args.payload.messageId,
      },
    );
    if (preFlightEventId) {
      return {
        eventId: preFlightEventId,
        type: "WebhookEvent",
        deduped: true,
      };
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
        payload: args.payload,
        subscriptionInfo,
      });
    } catch (error) {
      if (error instanceof WebhookNormalizationError) {
        // Only `UnknownEventType` is "unsupported but well-formed" —
        // ACK with a 200-class so Pub/Sub stops re-delivering it (the
        // SDK gateway has no use for one-off Google notification kinds
        // we don't model). The other two codes
        // (`MissingNotificationId`, `MissingPurchaseToken`) indicate a
        // malformed payload we genuinely cannot route — surface them
        // as ConvexError so `mapWebhookError` translates to 4xx and
        // the operator sees the rejection in their pubsub metrics
        // instead of having broken events silently swallowed.
        if (error.code === "UnknownEventType") {
          console.warn(
            "[webhooks/google] dropping unsupported notification",
            error.code,
            error.message,
          );
          throw new Error(`UNSUPPORTED_EVENT: ${error.message}`);
        }
        throw new ConvexError({ code: error.code, message: error.message });
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

    // Always run applySubscriptionEvent — see the matching note in
    // webhooks/apple.ts. The mutation is idempotent on lastEventId so
    // a no-op replay is cheap, but skipping on dedup left the
    // subscription stranded if a previous attempt persisted the event
    // then crashed before patching the subscription row (every Google
    // RTDN retry would dedup before reaching the state mutation).
    //
    // TestNotification is the one exception: it has no transaction
    // and therefore no purchaseToken. Skip the subscription mutation
    // for those — webhookEvents row alone confirms wiring.
    if (normalized.purchaseToken) {
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
/**
 * `Date.parse` returns NaN for any input it can't parse — and since
 * `webhookEvents.expiresAt`/`renewsAt` is typed as `v.number()` in the
 * schema, a NaN reaches Convex's validator and 500s the receiver. This
 * helper passes only finite numbers through; everything else collapses
 * to undefined so the downstream path uses the wall-clock dedup
 * heuristic instead.
 */
function parseEpochMs(input: string | undefined | null): number | undefined {
  if (!input) return undefined;
  const ms = Date.parse(input);
  return Number.isFinite(ms) ? ms : undefined;
}

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
    const cacheKey = String(projectId);
    let androidpublisher: androidpublisher_v3.Androidpublisher;
    const cached = playClientCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      androidpublisher = cached.client;
    } else {
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
      // Wrap the parse in a try/catch and surface a structured
      // ConvexError on failure. SyntaxError from a malformed service-
      // account upload would otherwise reach the route layer as an
      // un-mapped exception and 500 the Pub/Sub push, sending Google
      // into a retry loop on a permanent config error. ConvexError
      // → mapWebhookError → 400 so Pub/Sub gives up and the operator
      // sees the actionable code (PR #124
      // (https://github.com/hyodotdev/openiap/pull/124) review).
      let credentials: Record<string, unknown>;
      try {
        credentials = JSON.parse(fileContent.content) as Record<
          string,
          unknown
        >;
      } catch {
        throw new ConvexError({
          code: "INVALID_SERVICE_ACCOUNT_JSON",
          message:
            "Google Play service account JSON is malformed — re-upload the file generated from Google Cloud Console.",
        });
      }
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
      });
      androidpublisher = google.androidpublisher({ version: "v3", auth });
      playClientCache.set(cacheKey, {
        client: androidpublisher,
        expiresAt: Date.now() + PLAY_CLIENT_TTL_MS,
      });
    }

    // Per-request timeout — googleapis defaults to no timeout, and a
    // hung Play Developer API call would otherwise stall this Pub/Sub
    // ack until Convex's 10-min action ceiling kills the whole
    // pipeline. 10s is generous for what's usually a sub-second
    // request; missed enrichment is benign (the webhook still
    // dedups + flows through applySubscriptionEvent on the raw
    // payload — we just lose the v2 expiry/cancel context for this
    // notification, and the next event will have it).
    const response = await androidpublisher.purchases.subscriptionsv2.get(
      {
        packageName,
        token: payload.subscriptionNotification.purchaseToken,
      },
      { timeout: 10_000 },
    );

    const data = response.data;
    // `subscriptionsv2.get` always returns the v2 shape with
    // per-line-item `expiryTime`; the legacy `purchases.subscriptions.get`
    // had a root-level `expiryTimeMillis`, but we never call that
    // endpoint here.
    //
    // Pick the line item with the longest-dated `expiryTime`.
    // Subscriptions V2 supports multi-line-item bundles (base plan +
    // add-ons), and just taking `lineItems[0]` would mis-attribute one
    // entitlement's expiry / autoRenew to the entire subscription.
    //
    // We deliberately do NOT match by `latestSuccessfulOrderId`: that
    // field carries a GPA Order ID, while the notification carries a
    // `purchaseToken` (different identifier — PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review). The
    // longest-dated line item is the user-relevant "subscription is
    // good through" date and matches what the dashboard surfaces.
    const lineItems = data.lineItems ?? [];
    // `expiryTime` is an ISO string; max-by sorts by Date.parse order.
    const matched =
      lineItems.reduce<(typeof lineItems)[number] | undefined>((acc, li) => {
        if (!li.expiryTime) return acc;
        const score = Date.parse(li.expiryTime);
        if (!Number.isFinite(score)) return acc;
        const accScore = acc?.expiryTime
          ? Date.parse(acc.expiryTime)
          : -Infinity;
        return score > accScore ? li : acc;
      }, undefined) ?? lineItems[0];
    const expiry = matched?.expiryTime ?? undefined;
    // `autoRenewingPlan` presence is the authoritative v2 indicator
    // that auto-renewal is scheduled. Gating `renews` on
    // `recurringPrice` (the previous check) misses subscriptions in a
    // free-trial phase where the current price is 0 but renewal is
    // still on the calendar (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    const renews = matched?.autoRenewingPlan
      ? (expiry ?? undefined)
      : undefined;
    const recurring = matched?.autoRenewingPlan?.recurringPrice;

    return {
      state: data.subscriptionState ?? undefined,
      cancelReason: data.canceledStateContext?.userInitiatedCancellation
        ? "USER_CANCELED"
        : data.canceledStateContext?.systemInitiatedCancellation
          ? "SYSTEM_INITIATED_CANCELLATION"
          : undefined,
      // `Date.parse` returns NaN on malformed input, which would
      // hit Convex's number validator and 500 the webhook ingest.
      // Drop NaN to undefined so the receiver path falls back to the
      // wall-clock dedup heuristic (PR #124
      // (https://github.com/hyodotdev/openiap/pull/124) review).
      expiryTimeMillis: parseEpochMs(expiry),
      autoRenewingPlanRenewsTimeMillis: parseEpochMs(renews),
      currency: recurring?.currencyCode ?? undefined,
      // Use the shared moneyToMicros helper from products/play.ts —
      // same Google `Money` proto, same BigInt overflow concerns.
      // The shared version also guards against
      // `Number.MAX_SAFE_INTEGER` overflow and wraps the BigInt
      // parse in try/catch (handles malformed `units` instead of
      // throwing into the surrounding subscriptionsv2-get path).
      priceAmountMicros: moneyToMicros(recurring),
    };
  } catch (error) {
    // Sanitized: only the error name/code/message is logged. The full
    // googleapis error object can include the original request URL with
    // an OAuth bearer token and the response body — neither belongs in
    // logs that get shipped to error aggregation.
    const sanitized =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : "(unknown error type)";
    // Auth-shaped failures (401/403, "invalid_grant", "Invalid JWT")
    // typically mean the operator rotated the service account. Drop
    // the cached client so the next webhook re-reads the file and
    // picks up the new credentials immediately instead of waiting
    // out the full TTL on a known-bad key. Prefer the structured
    // error properties (`code` / `status`) the googleapis library
    // ships on its GaxiosError shape — substring matching the
    // serialized message also catches the case but is brittle
    // (Google has changed wording across SDK versions). The string
    // checks stay as a fallback for unwrapped errors.
    const errorCode =
      typeof error === "object" && error !== null
        ? ((error as { code?: unknown }).code ??
          (error as { status?: unknown }).status)
        : undefined;
    const numericAuthFailure =
      errorCode === 401 ||
      errorCode === 403 ||
      errorCode === "401" ||
      errorCode === "403";
    if (
      numericAuthFailure ||
      sanitized.includes("invalid_grant") ||
      sanitized.includes("Invalid JWT")
    ) {
      playClientCache.delete(String(projectId));
    }
    console.warn(
      "[webhooks/google] subscriptionsv2 fetch failed; falling back to type-derived state",
      sanitized,
    );
    return null;
  }
}
