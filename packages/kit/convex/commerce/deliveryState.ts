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
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { getWritableProject } from "../projects/writable";
import {
  COMMERCE_EVENT_SCHEMA_VERSION,
  type CommerceEvent,
  type CommerceEventType,
} from "./contract";
import {
  CLAIM_BATCH_LIMIT,
  COMMERCE_EVENT_RETENTION_MS,
  LEASE_MS,
  MAX_DELIVERY_ATTEMPTS,
  nextAttemptDelayMs,
} from "./signing";

/** Consecutive failures before a destination is parked for manual review. */
const BREAKER_THRESHOLD = 20;
const PRUNE_BATCH_LIMIT = 200;

export type ClaimedDelivery = {
  deliveryId: Id<"outboundDeliveries">;
  leaseToken: string;
  attempts: number;
  url: string;
  secret: string;
  previousSecret?: string;
  body: string;
  eventId: Id<"commerceEvents">;
};

/**
 * The wire body. Typed as `CommerceEvent` so the compiler, not a test, is what
 * keeps the payload equal to the published contract: storage-only columns
 * (`subscriptionId`, the internal `sourceEventId`) cannot leak in, and a
 * contract field cannot silently go missing.
 */
export function buildEventPayload(event: Doc<"commerceEvents">): CommerceEvent {
  return {
    eventId: event._id,
    eventType: event.eventType as CommerceEventType,
    eventVersion: event.eventVersion as typeof COMMERCE_EVENT_SCHEMA_VERSION,
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
    ...(event.subscription
      ? {
          subscription: {
            ...event.subscription,
            active: event.entitlementActive ?? false,
          },
        }
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
    ...(event.sourceStoreNotificationId
      ? { sourceStoreEventId: event.sourceStoreNotificationId }
      : {}),
    ...(event.extensions ? { extensions: event.extensions } : {}),
  };
}

export const claimPendingDeliveries = internalMutation({
  args: {
    limit: v.optional(v.number()),
    maxClaims: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      deliveryId: v.id("outboundDeliveries"),
      leaseToken: v.string(),
      attempts: v.number(),
      url: v.string(),
      secret: v.string(),
      previousSecret: v.optional(v.string()),
      body: v.string(),
      eventId: v.id("commerceEvents"),
    }),
  ),
  handler: async (ctx, args): Promise<ClaimedDelivery[]> =>
    claimPendingDeliveriesHandler(
      ctx,
      args.limit ?? CLAIM_BATCH_LIMIT,
      args.maxClaims ?? args.limit ?? CLAIM_BATCH_LIMIT,
    ),
});

export async function claimPendingDeliveriesHandler(
  ctx: MutationCtx,
  limit: number,
  maxClaims: number = limit,
): Promise<ClaimedDelivery[]> {
  const now = Date.now();
  // Recover crashed attempts first so a continuous pending backlog cannot
  // starve an expired lease forever.
  const stale = await ctx.db
    .query("outboundDeliveries")
    .withIndex("by_status_and_lease_expiry", (q) =>
      q.eq("status", "delivering").lte("leaseExpiresAt", now),
    )
    .take(limit);
  const due = await ctx.db
    .query("outboundDeliveries")
    .withIndex("by_status_and_next_attempt", (q) =>
      q.eq("status", "pending").lte("nextAttemptAt", now),
    )
    .take(limit - stale.length);
  const candidates = [...stale, ...due];

  const claimed: ClaimedDelivery[] = [];
  for (const delivery of candidates) {
    const project = await getWritableProject(ctx, delivery.projectId);
    if (!project) {
      await ctx.db.patch(delivery._id, {
        status: "failed",
        lastError: "project unavailable",
        leaseExpiresAt: undefined,
        leaseToken: undefined,
        updatedAt: now,
      });
      continue;
    }
    const destination = await ctx.db.get(delivery.destinationId);
    if (!destination || !destination.enabled || destination.pendingDeletion) {
      // Destination was disabled after the event was queued; drop the attempt
      // rather than holding a row that can never succeed.
      await ctx.db.patch(delivery._id, {
        status: "failed",
        lastError: "destination disabled",
        leaseExpiresAt: undefined,
        leaseToken: undefined,
        updatedAt: now,
      });
      continue;
    }
    const event = await ctx.db.get(delivery.eventId);
    if (!event) {
      await ctx.db.patch(delivery._id, {
        status: "failed",
        lastError: "event missing",
        leaseExpiresAt: undefined,
        leaseToken: undefined,
        updatedAt: now,
      });
      continue;
    }

    // The lease is what makes overlapping cron ticks safe: a claimed row moves
    // out of "pending" before the HTTP call starts. The token fences the write
    // back, so a reclaimed row ignores whatever the superseded attempt reports.
    const leaseToken = crypto.randomUUID();
    await ctx.db.patch(delivery._id, {
      status: "delivering",
      leaseExpiresAt: now + LEASE_MS,
      leaseToken,
      updatedAt: now,
    });
    claimed.push({
      deliveryId: delivery._id,
      leaseToken,
      attempts: delivery.attempts,
      url: destination.url,
      secret: destination.secret,
      ...(destination.previousSecret &&
      (destination.previousSecretExpiresAt ?? 0) > now
        ? { previousSecret: destination.previousSecret }
        : {}),
      body: JSON.stringify(buildEventPayload(event)),
      eventId: event._id,
    });
    if (claimed.length >= maxClaims) break;
  }
  return claimed;
}

export type RecordDeliveryResultArgs = {
  deliveryId: Id<"outboundDeliveries">;
  leaseToken: string;
  ok: boolean;
  statusCode?: number;
  error?: string;
  retryable: boolean;
};

export const recordDeliveryResult = internalMutation({
  args: {
    deliveryId: v.id("outboundDeliveries"),
    leaseToken: v.string(),
    ok: v.boolean(),
    statusCode: v.optional(v.number()),
    error: v.optional(v.string()),
    retryable: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => recordDeliveryResultHandler(ctx, args),
});

export async function recordDeliveryResultHandler(
  ctx: MutationCtx,
  args: RecordDeliveryResultArgs,
): Promise<null> {
  {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return null;
    // Lease was reclaimed and reissued while this attempt was in flight. Its
    // result describes a superseded send; the current holder owns the row.
    if (
      delivery.status !== "delivering" ||
      delivery.leaseToken !== args.leaseToken
    ) {
      return null;
    }
    const now = Date.now();
    const attempts = delivery.attempts + 1;
    const destination = await ctx.db.get(delivery.destinationId);

    if (args.ok) {
      await ctx.db.patch(delivery._id, {
        status: "delivered",
        attempts,
        deliveredAt: now,
        leaseExpiresAt: undefined,
        leaseToken: undefined,
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
      const eventDeliveries = await ctx.db
        .query("outboundDeliveries")
        .withIndex("by_event", (q) => q.eq("eventId", delivery.eventId))
        .collect();
      if (
        eventDeliveries.every(
          (row) => row._id === delivery._id || row.status === "delivered",
        )
      ) {
        const event = await ctx.db.get(delivery.eventId);
        if (event) {
          await ctx.db.patch(event._id, {
            prunableAt: now + COMMERCE_EVENT_RETENTION_MS,
          });
        }
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
      leaseToken: undefined,
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
  }
}

/** Requeue a dead-lettered delivery. Operator action, not automatic. */
export const replayDelivery = internalMutation({
  args: { deliveryId: v.id("outboundDeliveries") },
  returns: v.boolean(),
  handler: async (ctx, args) => replayDeliveryHandler(ctx, args.deliveryId),
});

export async function replayDeliveryHandler(
  ctx: MutationCtx,
  deliveryId: Id<"outboundDeliveries">,
): Promise<boolean> {
  {
    const args = { deliveryId };
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.status !== "failed") return false;
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
      lastError: undefined,
      leaseExpiresAt: undefined,
      leaseToken: undefined,
      updatedAt: now,
    });
    return true;
  }
}

export const pruneCommerceHistory = internalMutation({
  args: {
    olderThanMs: v.number(),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deletedDeliveries: v.number(),
    deletedEvents: v.number(),
  }),
  handler: async (ctx, args) =>
    pruneCommerceHistoryHandler(
      ctx,
      args.olderThanMs,
      args.batchSize ?? PRUNE_BATCH_LIMIT,
    ),
});

export async function pruneCommerceHistoryHandler(
  ctx: MutationCtx,
  olderThanMs: number,
  batchSize: number,
): Promise<{ deletedDeliveries: number; deletedEvents: number }> {
  const now = Date.now();
  const cutoff = now - olderThanMs;
  const delivered = await ctx.db
    .query("outboundDeliveries")
    .withIndex("by_status_and_updated", (q) =>
      q.eq("status", "delivered").lt("updatedAt", cutoff),
    )
    .take(batchSize);
  for (const delivery of delivered) await ctx.db.delete(delivery._id);

  const oldEvents = await ctx.db
    .query("commerceEvents")
    .withIndex("by_prunable_at", (q) => q.lte("prunableAt", now))
    .take(batchSize);
  let deletedEvents = 0;
  for (const event of oldEvents) {
    const retainedDelivery = await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .first();
    if (!retainedDelivery) {
      await ctx.db.delete(event._id);
      deletedEvents += 1;
    }
  }

  if (
    delivered.length === batchSize ||
    (oldEvents.length === batchSize && deletedEvents > 0)
  ) {
    await ctx.scheduler.runAfter(
      0,
      internal.commerce.deliveryState.pruneCommerceHistory,
      { olderThanMs, batchSize },
    );
  }
  return { deletedDeliveries: delivered.length, deletedEvents };
}
