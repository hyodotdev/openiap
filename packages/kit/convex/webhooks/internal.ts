import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assertProjectWritable } from "../projects/writable";
import {
  dataProvenanceValidator,
  subscriptionStateValidator,
} from "../utils/validation";

// Retention window for `webhookEvents` and `webhookIdempotencyKeys`.
// Keep the units literal (ms) so the cron scheduler call reads naturally.
export const WEBHOOK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type WebhookDedupSource = "apple" | "google";
type StoredWebhookSource =
  | "AppleAppStoreServerNotificationsV2"
  | "GooglePlayRealTimeDeveloperNotifications";
type WebhookEventReader = Pick<QueryCtx["db"], "query">;

interface WebhookEventDedupKey {
  projectId: Id<"projects">;
  source: StoredWebhookSource;
  sourceNotificationId: string;
}

function storedSourceForDedupSource(
  source: WebhookDedupSource,
): StoredWebhookSource {
  return source === "apple"
    ? "AppleAppStoreServerNotificationsV2"
    : "GooglePlayRealTimeDeveloperNotifications";
}

async function findWebhookEventByDedupKey(
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

// Read-only dedup probe for webhooks/google.ts, so a Pub/Sub retry skips the
// Play API call and its quota. Returns the recorded event id and purchase token
// for an ingested (projectId, source, sourceNotificationId); the apply mutation
// re-reads that event to repair state after a partial failure.
//
// webhookEvents is the dedup record (#241); idempotency-key reads cover only
// rows still in the table, until phase 4 drops it. Legacy rows without a
// projectId are not checked here and may cost one duplicate Play call;
// recordWebhookEvent still dedups the event itself.
export const lookupExistingEvent = internalQuery({
  args: {
    projectId: v.id("projects"),
    source: v.union(v.literal("apple"), v.literal("google")),
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
    let existingEvent = await findWebhookEventByDedupKey(ctx.db, {
      projectId: args.projectId,
      source: storedSourceForDedupSource(args.source),
      sourceNotificationId: args.sourceNotificationId,
    });
    if (!existingEvent) {
      const existingKey = await ctx.db
        .query("webhookIdempotencyKeys")
        .withIndex("by_project_and_source_and_id", (q) =>
          q
            .eq("projectId", args.projectId)
            .eq("source", args.source)
            .eq("sourceNotificationId", args.sourceNotificationId),
        )
        .unique();
      const keyedEvent = existingKey?.eventId
        ? await ctx.db.get(existingKey.eventId)
        : null;
      if (
        keyedEvent?.projectId === args.projectId &&
        keyedEvent.source === storedSourceForDedupSource(args.source) &&
        keyedEvent.sourceNotificationId === args.sourceNotificationId
      ) {
        existingEvent = keyedEvent;
      }
    }
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
// `deduped: true`. The only writer of webhookEvents and webhookIdempotencyKeys.
// It trusts its arguments: apple.ts and google.ts verify the signature and
// project first.
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
        v.literal("SubscriptionDeferred"),
        v.literal("SubscriptionPauseScheduleChanged"),
        v.literal("SubscriptionPendingPurchaseCanceled"),
        v.literal("SubscriptionPriceStepUpConsentChanged"),
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
      amountProvenance: v.optional(dataProvenanceValidator),
      occurredAt: v.number(),
      rawSignedPayload: v.optional(v.string()),
    }),
  },
  returns: v.object({
    eventId: v.id("webhookEvents"),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await assertProjectWritable(ctx, args.projectId);

    // Retries are normal (Apple retries on 5xx, Pub/Sub is at-least-once) and
    // must return 200. The webhookEvents index is the dedup record (#241); the
    // key reads below only drain rows from before phase 2.
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

    // Scoped by project: a Pub/Sub messageId is unique only within a topic, so
    // two projects can share one. Apple's UUID is global, but one key shape
    // keeps the lookup simple.
    let existing = await ctx.db
      .query("webhookIdempotencyKeys")
      .withIndex("by_project_and_source_and_id", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("source", args.source)
          .eq("sourceNotificationId", args.sourceNotificationId),
      )
      .unique();
    // Rows from before the projectId rollout have none, so a late retry would
    // miss them and re-apply a committed transition. Find them on the legacy
    // index, check the linked event's project, and backfill projectId.
    if (!existing) {
      // Not .unique(): projects' legacy rows can share a messageId.
      const legacyCandidates = await ctx.db
        .query("webhookIdempotencyKeys")
        .withIndex("by_source_and_id", (q) =>
          q
            .eq("source", args.source)
            .eq("sourceNotificationId", args.sourceNotificationId),
        )
        .collect();
      // Skip rows already migrated (projectId set) — those would have
      // been caught by the `by_project_and_source_and_id` index above.
      const legacyOnly = legacyCandidates.filter((row) => !row.projectId);
      // Keep the legacy row whose event belongs to this project; a half-written
      // row (no eventId) is the fallback.
      const linkedChecks = await Promise.all(
        legacyOnly.map(async (row) =>
          row.eventId
            ? {
                row,
                linked: await ctx.db.get(row.eventId),
              }
            : { row, linked: null },
        ),
      );
      const projectMatch = linkedChecks.find(
        (c) => c.linked && c.linked.projectId === args.projectId,
      );
      if (projectMatch) {
        await ctx.db.patch(projectMatch.row._id, {
          projectId: args.projectId,
        });
        existing = { ...projectMatch.row, projectId: args.projectId };
      } else {
        const halfWritten = linkedChecks.find(
          (c) => !c.row.eventId && !c.linked,
        );
        if (halfWritten) {
          // Half-written legacy row (insert succeeded, event insert
          // crashed): can't tie it to a project, but adopting it lets
          // the path below patch in our new eventId.
          existing = halfWritten.row;
        }
      }
    }

    if (existing?.eventId) {
      return { eventId: existing.eventId, deduped: true };
    }

    const now = Date.now();

    const eventId: Id<"webhookEvents"> = await ctx.db.insert("webhookEvents", {
      projectId: args.projectId,
      type: args.event.type,
      source: storedSource,
      platform: args.event.platform,
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

    if (existing) {
      // A half-written key (crash before the event insert): link it to the new
      // event, or the orphan sweep could delete a row a replay relies on.
      await ctx.db.patch(existing._id, { eventId });
    }
    // No new idempotency row (#241 phase 2): the event row itself dedups
    // replays. Old rows drain past WEBHOOK_RETENTION_MS before the table is
    // dropped.

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

    // Look up each event's keys in parallel: by project, and on the legacy
    // index for pre-rollout rows without a projectId, which the orphan sweep
    // skips (they have an eventId) and would otherwise outlive the retention
    // window.
    const keysToDelete = await Promise.all(
      oldEvents.map(async (event) => {
        const source: "apple" | "google" =
          event.source === "AppleAppStoreServerNotificationsV2"
            ? "apple"
            : "google";
        const [keyed, legacyCandidates] = await Promise.all([
          ctx.db
            .query("webhookIdempotencyKeys")
            .withIndex("by_project_and_source_and_id", (q) =>
              q
                .eq("projectId", event.projectId)
                .eq("source", source)
                .eq("sourceNotificationId", event.sourceNotificationId),
            )
            .unique(),
          ctx.db
            .query("webhookIdempotencyKeys")
            .withIndex("by_source_and_id", (q) =>
              q
                .eq("source", source)
                .eq("sourceNotificationId", event.sourceNotificationId),
            )
            .collect(),
        ]);
        // Only project-less rows pointing at this event: another project's row
        // may share the messageId.
        const legacy = legacyCandidates.filter(
          (row) => !row.projectId && row.eventId === event._id,
        );
        return [keyed, ...legacy].filter(
          (row): row is NonNullable<typeof row> => row != null,
        );
      }),
    );

    let deletedEvents = 0;
    let deletedKeys = 0;
    const seenKeyIds = new Set<string>();
    for (let i = 0; i < oldEvents.length; i++) {
      for (const key of keysToDelete[i]) {
        // Dedup across the project-keyed + legacy paths in case both
        // returned the same row (defense — they shouldn't overlap).
        if (seenKeyIds.has(key._id)) continue;
        seenKeyIds.add(key._id);
        // A key outliving its event could swallow a new notification reusing
        // the UUID.
        await ctx.db.delete(key._id);
        deletedKeys += 1;
      }
      await ctx.db.delete(oldEvents[i]._id);
      deletedEvents += 1;
    }

    // Orphan keys (a crash left eventId null) are unreachable by event; sweep
    // them via `by_first_seen_at`, bounded by `limit`.
    const orphanKeys = await ctx.db
      .query("webhookIdempotencyKeys")
      .withIndex("by_first_seen_at", (q) => q.lt("firstSeenAt", cutoff))
      .take(limit);
    for (const key of orphanKeys) {
      if (key.eventId) continue; // event-linked keys are handled above
      await ctx.db.delete(key._id);
      deletedKeys += 1;
    }

    return { deletedEvents, deletedKeys };
  },
});
