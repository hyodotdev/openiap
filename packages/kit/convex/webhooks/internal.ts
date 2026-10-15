import { internalMutation, internalQuery } from "../_generated/server";
import { v, ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import schema, { purchaseStoreValidator } from "../schema";
import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import { assertProjectWritable } from "../projects/writable";
import {
  cancellationReasonValidator,
  dataProvenanceValidator,
  subscriptionStateValidator,
} from "../utils/validation";

export { WEBHOOK_RETENTION_MS } from "./shared";

type WebhookDedupSource =
  | "apple"
  | "google"
  | "amazon"
  | "amazon-rvs"
  | "store-resync";
type StoredWebhookSource =
  | "AppleAppStoreServerNotificationsV2"
  | "GooglePlayRealTimeDeveloperNotifications"
  | "AmazonRealTimeNotifications"
  | "AmazonRvsReconciliation"
  | "StoreResync";
type WebhookEventReader = Pick<QueryCtx["db"], "query">;

interface WebhookEventDedupKey {
  projectId: Id<"projects">;
  source: StoredWebhookSource;
  sourceNotificationId: string;
}

function storedSourceForDedupSource(
  source: WebhookDedupSource,
): StoredWebhookSource {
  switch (source) {
    case "apple":
      return "AppleAppStoreServerNotificationsV2";
    case "google":
      return "GooglePlayRealTimeDeveloperNotifications";
    case "amazon":
      return "AmazonRealTimeNotifications";
    case "amazon-rvs":
      return "AmazonRvsReconciliation";
    case "store-resync":
      return "StoreResync";
  }
}

export async function findWebhookEventByDedupKey(
  db: WebhookEventReader,
  key: WebhookEventDedupKey,
): Promise<Doc<"webhookEvents"> | null> {
  return await db
    .query("webhookEvents")
    .withIndex("by_project_and_source_and_notification_id", (q) =>
      q
        .eq("projectId", key.projectId)
        .eq("source", key.source)
        .eq("sourceNotificationId", key.sourceNotificationId),
    )
    .unique();
}

export const getAmazonWebhookProject = internalQuery({
  args: { apiKey: v.string() },
  returns: schema.doc("projects"),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(ctx, args.apiKey);
    if (
      !resolved ||
      resolved.keyType !== "publishable" ||
      args.apiKey.startsWith("openiap-kit_sk_")
    )
      throw new ConvexError({
        code: "INVALID_API_KEY",
        message: "Use an active publishable project key for store webhooks",
      });
    return resolved.project;
  },
});

// Read-only dedup probe for webhooks/google.ts, so a Pub/Sub retry skips the
// Play API call and its quota. Returns the recorded event id and purchase token
// for an ingested (projectId, source, sourceNotificationId); the apply mutation
// re-reads that event to repair state after a partial failure.
export const lookupExistingEvent = internalQuery({
  args: {
    projectId: v.id("projects"),
    source: v.union(
      v.literal("apple"),
      v.literal("google"),
      v.literal("amazon"),
      v.literal("amazon-rvs"),
    ),
    sourceNotificationId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      eventId: v.id("webhookEvents"),
      type: v.string(),
      purchaseToken: v.optional(v.string()),
      linkedPurchaseToken: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const existingEvent = await findWebhookEventByDedupKey(ctx.db, {
      projectId: args.projectId,
      source: storedSourceForDedupSource(args.source),
      sourceNotificationId: args.sourceNotificationId,
    });
    if (!existingEvent) return null;

    return {
      eventId: existingEvent._id,
      type: existingEvent.type,
      purchaseToken: existingEvent.purchaseToken,
      linkedPurchaseToken: existingEvent.linkedPurchaseToken,
    };
  },
});

// Inserts a normalized webhook event, idempotent on (projectId, source,
// sourceNotificationId); a store retry gets the existing id with
// `deduped: true`. The only writer of webhookEvents.
// It trusts its arguments: apple.ts and google.ts verify the signature and
// project first.
const recordWebhookEventArgs = v.object({
  projectId: v.id("projects"),
  source: v.union(
    v.literal("apple"),
    v.literal("google"),
    v.literal("amazon"),
    v.literal("amazon-rvs"),
    v.literal("store-resync"),
  ),
  sourceNotificationId: v.string(),
  event: v.object({
    type: v.union(
      v.literal("SubscriptionStarted"),
      v.literal("SubscriptionRenewed"),
      v.literal("SubscriptionExpired"),
      v.literal("SubscriptionInGracePeriod"),
      v.literal("SubscriptionInBillingRetry"),
      v.literal("SubscriptionRecovered"),
      v.literal("SubscriptionCanceled"),
      v.literal("SubscriptionUncanceled"),
      v.literal("SubscriptionRevoked"),
      v.literal("SubscriptionPriceChange"),
      v.literal("SubscriptionProductChanged"),
      v.literal("SubscriptionPaused"),
      v.literal("SubscriptionResumed"),
      v.literal("SubscriptionDeferred"),
      v.literal("SubscriptionPauseScheduleChanged"),
      v.literal("SubscriptionPendingPurchaseCanceled"),
      v.literal("SubscriptionPriceStepUpConsentChanged"),
      v.literal("PurchaseRefunded"),
      v.literal("PurchaseConsumptionRequest"),
      v.literal("TestNotification"),
      v.literal("ReceiptRechecked"),
    ),
    sourceFull: v.union(
      v.literal("AppleAppStoreServerNotificationsV2"),
      v.literal("GooglePlayRealTimeDeveloperNotifications"),
      v.literal("AmazonRealTimeNotifications"),
      v.literal("AmazonRvsReconciliation"),
      v.literal("StoreResync"),
    ),
    platform: v.union(v.literal("IOS"), v.literal("Android")),
    store: v.optional(purchaseStoreValidator),
    environment: v.union(
      v.literal("Production"),
      v.literal("Sandbox"),
      v.literal("Xcode"),
    ),
    // Optional because TestNotification payloads carry no transaction.
    // Real lifecycle event types always populate this.
    purchaseToken: v.optional(v.string()),
    linkedPurchaseToken: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    originalTransactionId: v.optional(v.string()),
    applicationId: v.optional(v.string()),
    productKind: v.optional(
      v.union(v.literal("subscription"), v.literal("one_time")),
    ),
    productId: v.optional(v.string()),
    effectiveImmediately: v.optional(v.boolean()),
    subscriptionState: v.optional(subscriptionStateValidator),
    expiresAt: v.optional(v.number()),
    renewsAt: v.optional(v.number()),
    willRenew: v.optional(v.boolean()),
    cancellationReason: v.optional(cancellationReasonValidator),
    currency: v.optional(v.string()),
    priceAmountMicros: v.optional(v.number()),
    amountProvenance: v.optional(dataProvenanceValidator),
    occurredAt: v.number(),
    rawSignedPayload: v.optional(v.string()),
  }),
});

export async function recordWebhookEventHandler(
  ctx: MutationCtx,
  args: Infer<typeof recordWebhookEventArgs>,
): Promise<{ eventId: Id<"webhookEvents">; deduped: boolean }> {
  await assertProjectWritable(ctx, args.projectId);

  // Retries are normal (Apple retries on 5xx, Pub/Sub is at-least-once) and
  // must return 200. The source-aware webhookEvents index is the dedup record.
  const storedSource = storedSourceForDedupSource(args.source);
  if (args.event.sourceFull !== storedSource) {
    throw new Error(
      `Webhook source mismatch: ${args.source} cannot store ${args.event.sourceFull}`,
    );
  }
  const existingEvent = await findWebhookEventByDedupKey(ctx.db, {
    projectId: args.projectId,
    source: storedSource,
    sourceNotificationId: args.sourceNotificationId,
  });
  if (existingEvent) {
    return { eventId: existingEvent._id, deduped: true };
  }

  const now = Date.now();

  const eventId: Id<"webhookEvents"> = await ctx.db.insert("webhookEvents", {
    projectId: args.projectId,
    type: args.event.type,
    source: storedSource,
    platform: args.event.platform,
    store: args.event.store,
    environment: args.event.environment,
    purchaseToken: args.event.purchaseToken,
    linkedPurchaseToken: args.event.linkedPurchaseToken,
    transactionId: args.event.transactionId,
    originalTransactionId: args.event.originalTransactionId,
    applicationId: args.event.applicationId,
    productKind: args.event.productKind,
    sourceNotificationId: args.sourceNotificationId,
    productId: args.event.productId,
    effectiveImmediately: args.event.effectiveImmediately,
    subscriptionState: args.event.subscriptionState,
    expiresAt: args.event.expiresAt,
    renewsAt: args.event.renewsAt,
    willRenew: args.event.willRenew,
    cancellationReason: args.event.cancellationReason,
    currency: args.event.currency,
    priceAmountMicros: args.event.priceAmountMicros,
    amountProvenance: args.event.amountProvenance,
    rawSignedPayload: args.event.rawSignedPayload,
    occurredAt: args.event.occurredAt,
    receivedAt: now,
  });

  return { eventId, deduped: false };
}

export const recordWebhookEvent = internalMutation({
  args: recordWebhookEventArgs.fields,
  returns: v.object({ eventId: v.id("webhookEvents"), deduped: v.boolean() }),
  handler: recordWebhookEventHandler,
});

// Prune events older than the configured retention window. Run on a
// daily cron — `crons.ts` registers the schedule.
export const pruneWebhookEvents = internalMutation({
  args: {
    olderThanMs: v.number(),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ deletedEvents: v.number() }),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.olderThanMs;
    const limit = args.batchSize ?? 200;

    const oldEvents = await ctx.db
      .query("webhookEvents")
      .withIndex("by_received_at", (q) => q.lt("receivedAt", cutoff))
      .take(limit);

    // Preserve the compact source needed for a late bind before removing the
    // full event. This also upgrades subscriptions created before the compact
    // snapshot field existed.
    const referencingSubscriptions = await Promise.all(
      oldEvents.map((event) =>
        ctx.db
          .query("subscriptions")
          .withIndex("by_last_event", (q) => q.eq("lastEventId", event._id))
          .unique(),
      ),
    );
    for (let index = 0; index < oldEvents.length; index += 1) {
      const subscription = referencingSubscriptions[index];
      if (!subscription || subscription.lastEventSource) continue;
      const event = oldEvents[index];
      await ctx.db.patch(subscription._id, {
        lastEventOccurredAt: event.occurredAt,
        lastEventCreationTime: event._creationTime,
        lastEventSourceNotificationId: event.sourceNotificationId,
        lastEventSource: {
          type: event.type,
          environment: event.environment,
          productId: event.productId,
          applicationId: event.applicationId,
          transactionId: event.transactionId,
          originalTransactionId: event.originalTransactionId,
          currency: event.currency,
          priceAmountMicros: event.priceAmountMicros,
        },
      });
    }

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }

    return { deletedEvents: oldEvents.length };
  },
});
