import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { assertProjectWritable } from "../projects/writable";

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

// Cheap pre-flight dedup probe used by webhooks/google.ts to avoid
// burning Play Developer API quota on Pub/Sub retries. Returns the
// recorded event id and purchase token if the (projectId, source,
// sourceNotificationId) triple has already been ingested; null otherwise.
// The action passes that id to the apply mutation, which reads the authoritative
// stored event and repairs subscription state after a partial failure. Distinct from
// `recordWebhookEvent` because it's a query (no DB writes) and runs
// inside the Pub/Sub action's pre-Play-API path so a retry of an
// already-processed messageId can short-circuit before
// `purchases.subscriptionsv2.get` ever fires.
//
// Phases 1-2 of issue #241 make webhookEvents the authoritative dedup
// record. No new idempotency rows are written; the reads below remain
// only for rows still in the table, and go away with it in phase 4.
// Legacy rows (projectId == null) aren't checked here — they can still slip a
// duplicate Play API call through, but `recordWebhookEvent` retains the legacy
// fallback and will still dedup the actual event row.
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

// Insert a normalized webhook event with idempotency on
// `(projectId, source, sourceNotificationId)`. Returns the existing event id
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

    // Dedup check first. Apple ASN may retry the same notificationUUID
    // on transient 5xx, and Google Pub/Sub guarantees at-least-once
    // delivery — both are normal, both must result in HTTP 200 here.
    //
    // Issue #241 phases 1-2: the source-aware webhookEvents index is the
    // dedup record. The idempotency-key reads below are a drain-only
    // fallback for rows written before phase 2 — nothing writes new ones.
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

    // Scope dedup by projectId because Google Pub/Sub's messageId is
    // only guaranteed unique *within a topic* — different kit
    // projects can receive notifications with the same messageId
    // and the legacy (source, sourceNotificationId) key would
    // cross-pollute them. Apple's notificationUUID is globally
    // unique so this is belt-and-braces for ASN, but matching one
    // key shape keeps the lookup path simple.
    let existing = await ctx.db
      .query("webhookIdempotencyKeys")
      .withIndex("by_project_and_source_and_id", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("source", args.source)
          .eq("sourceNotificationId", args.sourceNotificationId),
      )
      .unique();
    // Legacy-row fallback: rows written before the projectId rollout
    // don't carry a projectId, so the indexed lookup above misses
    // them. Without this fallback, a webhook retry that arrives
    // *after* the rollout for an event recorded *before* it would
    // bypass dedup and create a fresh webhookEvents row + return a
    // new eventId — applySubscriptionEvent would then re-apply a
    // transition that's already been committed. We re-query the
    // legacy index, confirm the linked event belongs to this
    // project, and rehydrate projectId on the row so the next
    // lookup hits the new index directly.
    if (!existing) {
      // Use `.collect()` (not `.unique()`) here. The legacy index is
      // `(source, sourceNotificationId)` only, and Google Pub/Sub
      // `messageId`s are only unique *within a topic* — so the same
      // messageId can appear in legacy rows belonging to different
      // projects. `.unique()` would throw on those collisions instead
      // of letting us pick the row that matches this project.
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
      // Find a legacy row whose linked event belongs to *this* project.
      // Walk events in parallel; whichever links to args.projectId is
      // ours. Half-written rows (no eventId) are kept as a fallback to
      // adopt below if no project-matched row exists.
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
      rawSignedPayload: args.event.rawSignedPayload,
      occurredAt: args.event.occurredAt,
      receivedAt: now,
    });

    if (existing) {
      // Idempotency key existed without an eventId (a previous attempt
      // crashed between dedup-row insert and event insert). Patch it
      // to point at the newly-inserted event so future replays dedup.
      // Still done for rows already in the table: until they drain, the
      // fallback above can adopt one, and leaving it unlinked would let
      // the orphan sweep delete a row a replay is relying on.
      await ctx.db.patch(existing._id, { eventId });
    }
    // Issue #241 phase 2: no NEW idempotency row. The event inserted
    // just above carries the same (projectId, source,
    // sourceNotificationId) triple and is written in this transaction,
    // so a replay is deduped by the index read at the top of this
    // handler — the key row was a second copy of a guarantee
    // webhookEvents already made, at double the write cost per webhook.
    // Existing rows stay readable and prunable until they age out past
    // WEBHOOK_RETENTION_MS, which is what phase 3 waits for before the
    // table and its fallbacks can be dropped.

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

    // Resolve every matching idempotency key in parallel before
    // touching the DB writer. The previous loop did one .unique()
    // per event sequentially, so a 500-row prune required 500 RTTs.
    // Promise.all here issues them in a single flight — Convex
    // serializes them internally on the storage layer but the
    // round-trip cost collapses.
    //
    // Two flavors per event:
    //   1. project-keyed lookup via the `by_project_and_source_and_id`
    //      index — covers every row written after the projectId rollout.
    //   2. legacy fallback via `by_source_and_id` — pre-rollout rows
    //      that point at this event but have `projectId == null`. We
    //      can't query them through index 1, and the orphan sweep
    //      below skips rows with a non-null `eventId`, so without
    //      this they survive past the advertised retention window.
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
        // Filter legacy candidates to only the rows that (a) lack a
        // projectId (otherwise they'd already be the indexed match)
        // and (b) point at *this* event id — preventing accidental
        // collateral damage from cross-project messageId collisions
        // in the legacy table.
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

    // Also sweep orphan idempotency keys older than the cutoff —
    // half-written rows from prior crashes (key insert succeeded,
    // event insert failed) where eventId stayed null and the
    // by-event lookup above can never reach them. Uses the
    // `by_first_seen_at` range index so the scan stays bounded by
    // `limit` instead of full-scanning the table as it grows.
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
