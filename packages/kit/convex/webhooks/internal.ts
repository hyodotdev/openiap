import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

// Cheap pre-flight dedup probe used by webhooks/google.ts to avoid
// burning Play Developer API quota on Pub/Sub retries. Returns the
// existing eventId if the (projectId, source, sourceNotificationId)
// triple has already been ingested; null otherwise. Distinct from
// `recordWebhookEvent` because it's a query (no DB writes) and runs
// inside the Pub/Sub action's pre-Play-API path so a retry of an
// already-processed messageId can short-circuit before
// `purchases.subscriptionsv2.get` ever fires.
//
// Note: this only checks the new project-keyed index. Legacy rows
// (projectId == null) aren't checked here — they can still slip a
// duplicate Play API call through, but the legacy fallback is rare
// and `recordWebhookEvent` will still dedup the actual event row.
export const lookupExistingEvent = internalQuery({
  args: {
    projectId: v.id("projects"),
    source: v.union(v.literal("apple"), v.literal("google")),
    sourceNotificationId: v.string(),
  },
  returns: v.union(v.null(), v.id("webhookEvents")),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookIdempotencyKeys")
      .withIndex("by_project_and_source_and_id", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("source", args.source)
          .eq("sourceNotificationId", args.sourceNotificationId),
      )
      .unique();
    return existing?.eventId ?? null;
  },
});

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
      // Optional because TestNotification payloads carry no transaction.
      // Real lifecycle event types always populate this.
      purchaseToken: v.optional(v.string()),
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
        projectId: args.projectId,
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
