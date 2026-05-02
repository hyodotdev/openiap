import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

// Insert a normalized webhook event with idempotency on
// `(source, sourceNotificationId)`. Returns the existing event id
// (and `deduped: true`) if Apple/Google retries the same notification.
//
// This is the only path that writes to `webhookEvents` /
// `webhookIdempotencyKeys`. The action layer (apple.ts / google.ts)
// must verify the upstream signature and project ownership before
// calling this — the mutation trusts its arguments.
export const recordWebhookEvent = internalMutation({
  args: {
    projectId: v.id("projects"),
    source: v.union(v.literal("apple"), v.literal("google")),
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
        v.literal("PurchaseRefunded"),
        v.literal("PurchaseConsumptionRequest"),
        v.literal("TestNotification"),
      ),
      sourceFull: v.union(
        v.literal("AppleAppStoreServerNotificationsV2"),
        v.literal("GooglePlayRealTimeDeveloperNotifications"),
      ),
      platform: v.union(v.literal("IOS"), v.literal("Android")),
      environment: v.union(
        v.literal("Production"),
        v.literal("Sandbox"),
        v.literal("Xcode"),
      ),
      purchaseToken: v.string(),
      productId: v.optional(v.string()),
      subscriptionState: v.optional(
        v.union(
          v.literal("Active"),
          v.literal("InGracePeriod"),
          v.literal("InBillingRetry"),
          v.literal("Expired"),
          v.literal("Revoked"),
          v.literal("Refunded"),
          v.literal("Paused"),
          v.literal("Unknown"),
        ),
      ),
      expiresAt: v.optional(v.number()),
      renewsAt: v.optional(v.number()),
      cancellationReason: v.optional(
        v.union(
          v.literal("UserCanceled"),
          v.literal("BillingError"),
          v.literal("PriceIncreaseDeclined"),
          v.literal("ProductUnavailable"),
          v.literal("Refunded"),
          v.literal("Other"),
        ),
      ),
      currency: v.optional(v.string()),
      priceAmountMicros: v.optional(v.number()),
      occurredAt: v.number(),
      rawSignedPayload: v.optional(v.string()),
    }),
  },
  returns: v.object({
    eventId: v.id("webhookEvents"),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Dedup check first. Apple ASN may retry the same notificationUUID
    // on transient 5xx, and Google Pub/Sub guarantees at-least-once
    // delivery — both are normal, both must result in HTTP 200 here.
    //
    // TODO(schema-cleanup): the `webhookIdempotencyKeys` table is
    // arguably redundant with `webhookEvents.by_project_and_notification_id`
    // — that index already enforces uniqueness on
    // `(projectId, sourceNotificationId)`. We could fold the dedup
    // check into a direct lookup against webhookEvents and drop
    // this table entirely, halving the per-webhook write
    // amplification. Deferred to a separate PR because removing
    // the table requires a migration step + careful coordination
    // with the existing prune cron.
    const existing = await ctx.db
      .query("webhookIdempotencyKeys")
      .withIndex("by_source_and_id", (q) =>
        q
          .eq("source", args.source)
          .eq("sourceNotificationId", args.sourceNotificationId),
      )
      .unique();

    if (existing?.eventId) {
      return { eventId: existing.eventId, deduped: true };
    }

    const now = Date.now();

    const eventId: Id<"webhookEvents"> = await ctx.db.insert("webhookEvents", {
      projectId: args.projectId,
      type: args.event.type,
      source: args.event.sourceFull,
      platform: args.event.platform,
      environment: args.event.environment,
      purchaseToken: args.event.purchaseToken,
      sourceNotificationId: args.sourceNotificationId,
      productId: args.event.productId,
      subscriptionState: args.event.subscriptionState,
      expiresAt: args.event.expiresAt,
      renewsAt: args.event.renewsAt,
      cancellationReason: args.event.cancellationReason,
      currency: args.event.currency,
      priceAmountMicros: args.event.priceAmountMicros,
      rawSignedPayload: args.event.rawSignedPayload,
      occurredAt: args.event.occurredAt,
      receivedAt: now,
    });

    if (existing) {
      // Idempotency key existed without an eventId (a previous attempt
      // crashed between dedup-row insert and event insert). Patch it
      // to point at the newly-inserted event so future replays dedup.
      await ctx.db.patch(existing._id, { eventId });
    } else {
      await ctx.db.insert("webhookIdempotencyKeys", {
        source: args.source,
        sourceNotificationId: args.sourceNotificationId,
        eventId,
        firstSeenAt: now,
      });
    }

    return { eventId, deduped: false };
  },
});

// Prune events older than the configured retention window. Run on a
// daily cron — `crons.ts` registers the schedule.
export const pruneWebhookEvents = internalMutation({
  args: {
    olderThanMs: v.number(),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ deletedEvents: v.number(), deletedKeys: v.number() }),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.olderThanMs;
    const limit = args.batchSize ?? 200;

    const oldEvents = await ctx.db
      .query("webhookEvents")
      .withIndex("by_received_at", (q) => q.lt("receivedAt", cutoff))
      .take(limit);

    // Resolve every matching idempotency key in parallel before
    // touching the DB writer. The previous loop did one .unique()
    // per event sequentially, so a 500-row prune required 500 RTTs.
    // Promise.all here issues them in a single flight — Convex
    // serializes them internally on the storage layer but the
    // round-trip cost collapses.
    const keysToDelete = await Promise.all(
      oldEvents.map(async (event) =>
        ctx.db
          .query("webhookIdempotencyKeys")
          .withIndex("by_source_and_id", (q) =>
            q
              .eq(
                "source",
                event.source === "AppleAppStoreServerNotificationsV2"
                  ? "apple"
                  : "google",
              )
              .eq("sourceNotificationId", event.sourceNotificationId),
          )
          .unique(),
      ),
    );

    let deletedEvents = 0;
    let deletedKeys = 0;
    for (let i = 0; i < oldEvents.length; i++) {
      const key = keysToDelete[i];
      if (key) {
        // Drop the matching idempotency row. Without this, a stale
        // dedup record could outlive its event and silently swallow
        // a future (legitimately new) notification that reuses the
        // UUID — very unlikely in practice, but the invariant is
        // cheap to keep.
        await ctx.db.delete(key._id);
        deletedKeys += 1;
      }
      await ctx.db.delete(oldEvents[i]._id);
      deletedEvents += 1;
    }

    return { deletedEvents, deletedKeys };
  },
});
