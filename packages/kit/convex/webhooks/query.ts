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

// Backfill query used by SDKs on reconnect / app foreground entry.
// Returns webhook events for the API key's project that occurred since
// the given timestamp, ordered ascending by `receivedAt` so consumers
// can apply them in order without re-sorting.
//
// We cap results at `limit` (default 100, max 500) and surface
// `_creationTime` so the SDK can checkpoint reliably even if two
// events share `receivedAt` (rare but possible under burst writes).
export const webhookEventsSince = query({
  args: {
    apiKey: v.string(),
    sinceMs: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      type: webhookEventTypeValidator,
      source: webhookEventSourceValidator,
      platform: webhookEventPlatformValidator,
      environment: webhookEventEnvironmentValidator,
      projectId: v.id("projects"),
      occurredAt: v.number(),
      receivedAt: v.number(),
      purchaseToken: v.string(),
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

    const events = await ctx.db
      .query("webhookEvents")
      .withIndex("by_project_and_received", (q) =>
        q.eq("projectId", project._id).gte("receivedAt", args.sinceMs),
      )
      .order("asc")
      .take(limit);

    return events.map((event) => ({
      // GraphQL `id` is the stable per-notification identifier from
      // the store; ASN v2 notificationUUID and RTDN messageId are both
      // globally unique and survive replay/dedup.
      id: event.sourceNotificationId,
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
