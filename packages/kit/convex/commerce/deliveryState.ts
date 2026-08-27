// Persistence half of outbound delivery: claim/lease, result recording and
// replay. Convex only allows actions in a "use node" module, so the HTTP half
// lives in `delivery.ts` and calls into these mutations.
//
// Direction is strictly store → IAPKit → developer backend. This is
// server-to-server only: destinations are HTTPS endpoints a project owner
// registered, nothing here is reachable from a shipped app, and no
// client-pullable stream exists.

import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { MAX_DELIVERY_ATTEMPTS, nextAttemptDelayMs } from "./signing";

const CLAIM_BATCH_LIMIT = 25;
const LEASE_MS = 60_000;
/** Consecutive failures before a destination is parked for manual review. */
const BREAKER_THRESHOLD = 20;

export type ClaimedDelivery = {
  deliveryId: Id<"outboundDeliveries">;
  attempts: number;
  url: string;
  secret: string;
  previousSecret?: string;
  body: string;
  eventId: Id<"commerceEvents">;
};

/** Body sent to destinations. Deliberately free of raw store payloads. */
function serializeEvent(event: Doc<"commerceEvents">): string {
  return JSON.stringify({
    eventId: event._id,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    occurredAt: event.occurredAt,
    processedAt: event.processedAt,
    store: event.store,
    environment: event.environment,
    projectId: event.projectId,
    ...(event.applicationId ? { applicationId: event.applicationId } : {}),
    ...(event.userId ? { userId: event.userId } : {}),
    ...(event.productId ? { productId: event.productId } : {}),
    ...(event.transactionId ? { transactionId: event.transactionId } : {}),
    ...(event.originalTransactionId
      ? { originalTransactionId: event.originalTransactionId }
      : {}),
    ...(event.subscriptionId ? { subscriptionId: event.subscriptionId } : {}),
    ...(event.entitlementActive !== undefined
      ? { entitlementActive: event.entitlementActive }
      : {}),
    ...(event.currency && event.amountMicros !== undefined
      ? {
          price: {
            currency: event.currency,
            amountMicros: event.amountMicros,
            provenance: event.amountProvenance ?? "inferred",
          },
        }
      : {}),
    ...(event.extensions ? { extensions: event.extensions } : {}),
  });
}

export const claimPendingDeliveries = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      deliveryId: v.id("outboundDeliveries"),
      attempts: v.number(),
      url: v.string(),
      secret: v.string(),
      previousSecret: v.optional(v.string()),
      body: v.string(),
      eventId: v.id("commerceEvents"),
    }),
  ),
  handler: async (ctx, args): Promise<ClaimedDelivery[]> =>
    claimPendingDeliveriesHandler(ctx, args.limit ?? CLAIM_BATCH_LIMIT),
});

export async function claimPendingDeliveriesHandler(
  ctx: MutationCtx,
  limit: number,
): Promise<ClaimedDelivery[]> {
  const now = Date.now();
  const due = await ctx.db
    .query("outboundDeliveries")
    .withIndex("by_status_and_next_attempt", (q) =>
      q.eq("status", "pending").lte("nextAttemptAt", now),
    )
    .take(limit);

  // An action that crashed or timed out mid-attempt leaves its row in
  // "delivering" forever, because the pending scan above cannot see it.
  // Reclaim once the lease has expired; the receiver is expected to be
  // idempotent on `openiap-event-id`, so a re-send is safe.
  if (due.length < limit) {
    const stale = await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_status_and_next_attempt", (q) =>
        q.eq("status", "delivering"),
      )
      .take(limit - due.length);
    for (const row of stale) {
      if ((row.leaseExpiresAt ?? 0) <= now) due.push(row);
    }
  }

  const claimed: ClaimedDelivery[] = [];
  for (const delivery of due) {
    const destination = await ctx.db.get(delivery.destinationId);
    if (!destination || !destination.enabled) {
      // Destination was disabled after the event was queued; drop the attempt
      // rather than holding a row that can never succeed.
      await ctx.db.patch(delivery._id, {
        status: "failed",
        lastError: "destination disabled",
        updatedAt: now,
      });
      continue;
    }
    const event = await ctx.db.get(delivery.eventId);
    if (!event) {
      await ctx.db.patch(delivery._id, {
        status: "failed",
        lastError: "event missing",
        updatedAt: now,
      });
      continue;
    }

    // The lease is what makes overlapping cron ticks safe: a claimed row moves
    // out of "pending" before the HTTP call starts.
    await ctx.db.patch(delivery._id, {
      status: "delivering",
      leaseExpiresAt: now + LEASE_MS,
      updatedAt: now,
    });
    claimed.push({
      deliveryId: delivery._id,
      attempts: delivery.attempts,
      url: destination.url,
      secret: destination.secret,
      ...(destination.previousSecret &&
      (destination.previousSecretExpiresAt ?? 0) > now
        ? { previousSecret: destination.previousSecret }
        : {}),
      body: serializeEvent(event),
      eventId: event._id,
    });
  }
  return claimed;
}

export const recordDeliveryResult = internalMutation({
  args: {
    deliveryId: v.id("outboundDeliveries"),
    ok: v.boolean(),
    statusCode: v.optional(v.number()),
    error: v.optional(v.string()),
    retryable: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return null;
    const now = Date.now();
    const attempts = delivery.attempts + 1;
    const destination = await ctx.db.get(delivery.destinationId);

    if (args.ok) {
      await ctx.db.patch(delivery._id, {
        status: "delivered",
        attempts,
        deliveredAt: now,
        leaseExpiresAt: undefined,
        ...(args.statusCode ? { lastStatusCode: args.statusCode } : {}),
        updatedAt: now,
      });
      if (destination) {
        await ctx.db.patch(destination._id, {
          consecutiveFailures: 0,
          lastSuccessAt: now,
          updatedAt: now,
        });
      }
      return null;
    }

    const exhausted = attempts >= MAX_DELIVERY_ATTEMPTS || !args.retryable;
    await ctx.db.patch(delivery._id, {
      // A dead-lettered row keeps its payload reference so replay does not
      // need to re-derive the event.
      status: exhausted ? "failed" : "pending",
      attempts,
      nextAttemptAt: now + nextAttemptDelayMs(attempts),
      leaseExpiresAt: undefined,
      ...(args.statusCode ? { lastStatusCode: args.statusCode } : {}),
      ...(args.error ? { lastError: args.error.slice(0, 500) } : {}),
      updatedAt: now,
    });

    if (destination) {
      const consecutive = (destination.consecutiveFailures ?? 0) + 1;
      const trip = consecutive >= BREAKER_THRESHOLD;
      await ctx.db.patch(destination._id, {
        consecutiveFailures: consecutive,
        lastFailureAt: now,
        ...(trip
          ? {
              enabled: false,
              disabledReason: `auto-disabled after ${consecutive} consecutive failures`,
            }
          : {}),
        updatedAt: now,
      });
    }
    return null;
  },
});

/** Requeue a dead-lettered delivery. Operator action, not automatic. */
export const replayDelivery = internalMutation({
  args: { deliveryId: v.id("outboundDeliveries") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.status !== "failed") return false;
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
      lastError: undefined,
      updatedAt: now,
    });
    return true;
  },
});
