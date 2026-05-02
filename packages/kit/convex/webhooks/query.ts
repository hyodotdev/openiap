import { query } from "../_generated/server";
import { v } from "convex/values";

import {
  webhookEventTypeValidator,
  webhookEventSourceValidator,
  webhookEventEnvironmentValidator,
  subscriptionStateValidator,
  webhookCancellationReasonValidator,
  webhookEventPlatformValidator,
} from "./validators";

// Stream cursor lookup. Resolves a stable `sourceNotificationId`
// (ASN v2 notificationUUID or RTDN messageId) into a `receivedAt`
// timestamp + Convex `_creationTime` so the SSE reconnect path can
// resume right after the last event the consumer acknowledged.
//
// Surfaces both `receivedAt` and `_creationTime` because two events
// can share `receivedAt` under burst writes — the SSE consumer needs
// the creationTime tie-break to avoid re-emitting the boundary event.
//
// Uses the dedicated `by_project_and_notification_id` index so the
// lookup is O(log n) regardless of how many webhook events the
// project has accumulated. The prior implementation scanned the
// first 500 events via `webhookEventsSince(sinceMs: 0, limit: 500)`
// and silently fell back to "now" for any project with > 500 events.
export const findEventCursor = query({
  args: {
    apiKey: v.string(),
    sourceNotificationId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      receivedAt: v.number(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!project) return null;

    const event = await ctx.db
      .query("webhookEvents")
      .withIndex("by_project_and_notification_id", (q) =>
        q
          .eq("projectId", project._id)
          .eq("sourceNotificationId", args.sourceNotificationId),
      )
      .first();
    if (!event) return null;
    return {
      receivedAt: event.receivedAt,
      _creationTime: event._creationTime,
    };
  },
});

// Backfill query used by SDKs on reconnect / app foreground entry.
// Returns webhook events for the API key's project that occurred since
// the given timestamp, ordered ascending by `receivedAt` so consumers
// can apply them in order without re-sorting.
//
// We cap results at `limit` (default 100, max 500) and surface
// `_creationTime` so the SDK can checkpoint reliably even if two
// events share `receivedAt` (rare but possible under burst writes).
//
// Optional `afterCreationTime`: when provided alongside `sinceMs`, we
// only emit events whose `_creationTime` is strictly greater than
// the cursor — the tie-break that lets pagination advance past a
// `receivedAt` cohort larger than `limit`. Without it, a burst of
// 500+ events sharing one `receivedAt` would stick the cursor at
// the same value forever (PR #124 review fix).
export const webhookEventsSince = query({
  args: {
    apiKey: v.string(),
    sinceMs: v.number(),
    afterCreationTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      // Convex auto-assigned `_creationTime` (epoch ms, monotonic per
      // doc insert). Surfaced so SDKs can checkpoint reliably even
      // when two events share the same `receivedAt` — the wall-clock
      // tie-breaker is not unique under burst writes (PR #124 review
      // fix). The Convex doc id (`_id`) is also surfaced for the same
      // reason; `id` (sourceNotificationId) stays the spec-stable
      // identifier consumers gate on.
      _creationTime: v.number(),
      _id: v.id("webhookEvents"),
      type: webhookEventTypeValidator,
      source: webhookEventSourceValidator,
      platform: webhookEventPlatformValidator,
      environment: webhookEventEnvironmentValidator,
      projectId: v.id("projects"),
      occurredAt: v.number(),
      receivedAt: v.number(),
      // Optional because TestNotification rows carry no transaction.
      purchaseToken: v.optional(v.string()),
      productId: v.optional(v.string()),
      subscriptionState: v.optional(subscriptionStateValidator),
      expiresAt: v.optional(v.number()),
      renewsAt: v.optional(v.number()),
      cancellationReason: v.optional(webhookCancellationReasonValidator),
      currency: v.optional(v.string()),
      priceAmountMicros: v.optional(v.number()),
      rawSignedPayload: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!project) {
      // Mirror the convention used by other v1 routes: return empty
      // rather than throwing on bad credentials so the route layer can
      // attach 401 semantics uniformly via apiKeyMiddleware.
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);

    // Take up to 5000 when `afterCreationTime` is in play so the
    // in-memory filter still has `limit` events to return after
    // dropping rows at the boundary millisecond. 5000 covers the
    // realistic worst-case cohort (Apple/Google never fire that
    // many events in a single ms in production); the saturated-
    // cohort case beyond that bound is handled at the SSE layer in
    // webhooks.ts which loops with the tuple cursor
    // `(receivedAt, _creationTime)`. An inner loop here would
    // either skip events still in the boundary millisecond
    // (`cursor = lastReceivedAt + 1`) or duplicate the SSE loop's
    // logic, so we keep the query primitive and let the next layer
    // handle pathological collations.
    const fetchLimit = args.afterCreationTime
      ? Math.min(limit * 10, 5000)
      : limit;
    const raw = await ctx.db
      .query("webhookEvents")
      .withIndex("by_project_and_received", (q) =>
        q.eq("projectId", project._id).gte("receivedAt", args.sinceMs),
      )
      .order("asc")
      .take(fetchLimit);
    const events = (
      args.afterCreationTime
        ? raw.filter(
            (e) =>
              e.receivedAt > args.sinceMs ||
              e._creationTime > args.afterCreationTime!,
          )
        : raw
    ).slice(0, limit);

    return events.map((event) => ({
      // GraphQL `id` is the stable per-notification identifier from
      // the store; ASN v2 notificationUUID and RTDN messageId are both
      // globally unique and survive replay/dedup.
      id: event.sourceNotificationId,
      _creationTime: event._creationTime,
      _id: event._id,
      type: event.type,
      source: event.source,
      platform: event.platform,
      environment: event.environment,
      projectId: event.projectId,
      occurredAt: event.occurredAt,
      receivedAt: event.receivedAt,
      purchaseToken: event.purchaseToken,
      productId: event.productId,
      subscriptionState: event.subscriptionState,
      expiresAt: event.expiresAt,
      renewsAt: event.renewsAt,
      cancellationReason: event.cancellationReason,
      currency: event.currency,
      priceAmountMicros: event.priceAmountMicros,
      rawSignedPayload: event.rawSignedPayload,
    }));
  },
});
