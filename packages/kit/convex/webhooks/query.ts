import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
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

const webhookEventStreamShape = v.object({
  id: v.string(),
  // Convex auto-assigned `_creationTime` (epoch ms, monotonic per
  // doc insert). Surfaced so SDKs can checkpoint reliably even
  // when two events share the same `receivedAt` — the wall-clock
  // tie-breaker is not unique under burst writes (PR #124 (https://github.com/hyodotdev/openiap/pull/124) review
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
});

function shapeWebhookEvent(event: Doc<"webhookEvents">) {
  return {
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
  };
}

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
// the same value forever (PR #124 (https://github.com/hyodotdev/openiap/pull/124) review fix).
export const webhookEventsSince = query({
  args: {
    apiKey: v.string(),
    sinceMs: v.number(),
    afterCreationTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(webhookEventStreamShape),
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

    // Two-phase walk on the `(projectId, receivedAt, _creationTime)`
    // composite index so we never need an in-memory boundary filter
    // — which would silently drop pages when a single-millisecond
    // burst exceeded the in-memory cap. Phase 1 (only when
    // `afterCreationTime` is set) exhausts the boundary-millisecond
    // tail past the cursor via `gt("_creationTime", ...)`; Phase 2
    // walks the post-boundary range via `gt("receivedAt", ...)`. The
    // SSE layer in webhooks.ts handles the inverse case (consumer
    // catching up across many millisecond cohorts) by looping with
    // the tuple cursor (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    let events: Array<Doc<"webhookEvents">> = [];
    if (args.afterCreationTime !== undefined) {
      const boundaryTail = await ctx.db
        .query("webhookEvents")
        .withIndex("by_project_and_received_and_creation", (q) =>
          q
            .eq("projectId", project._id)
            .eq("receivedAt", args.sinceMs)
            .gt("_creationTime", args.afterCreationTime!),
        )
        .order("asc")
        .take(limit);
      events.push(...boundaryTail);
    }
    if (events.length < limit) {
      const postBoundary = await ctx.db
        .query("webhookEvents")
        .withIndex("by_project_and_received_and_creation", (q) =>
          q.eq("projectId", project._id).gt("receivedAt", args.sinceMs),
        )
        .order("asc")
        .take(limit - events.length);
      events.push(...postBoundary);
    }
    if (args.afterCreationTime === undefined) {
      // `afterCreationTime` not in play: include the boundary cohort.
      // The post-boundary scan above used `gt(receivedAt, sinceMs)`
      // which excludes it, so prepend the `eq(receivedAt, sinceMs)`
      // matches up to the limit.
      const boundary = await ctx.db
        .query("webhookEvents")
        .withIndex("by_project_and_received_and_creation", (q) =>
          q.eq("projectId", project._id).eq("receivedAt", args.sinceMs),
        )
        .order("asc")
        .take(limit);
      events = [...boundary, ...events].slice(0, limit);
    }

    return events.map(shapeWebhookEvent);
  },
});

// Reactive wake-up query for the SSE live tail. Unlike
// `webhookEventsSince`, this returns the latest matching window so the
// Convex subscription result keeps changing as new rows arrive. The
// route still drains through `webhookEventsSince` with its own moving
// cursor; this query only tells the route that there is fresh work.
export const latestWebhookEventsSince = query({
  args: {
    apiKey: v.string(),
    sinceMs: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(webhookEventStreamShape),
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!project) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const latest = await ctx.db
      .query("webhookEvents")
      .withIndex("by_project_and_received_and_creation", (q) =>
        q.eq("projectId", project._id).gte("receivedAt", args.sinceMs),
      )
      .order("desc")
      .take(limit);

    return latest.reverse().map(shapeWebhookEvent);
  },
});
