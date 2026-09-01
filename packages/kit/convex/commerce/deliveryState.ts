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
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "../_generated/server";
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
import { assertProjectAdmin } from "./destinations";
import { destinationAcceptsType } from "./internal";

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
    ...(event.previousProductId
      ? { previousProductId: event.previousProductId }
      : {}),
    ...(event.transactionId ? { transactionId: event.transactionId } : {}),
    ...(event.originalTransactionId
      ? { originalTransactionId: event.originalTransactionId }
      : {}),
    // `active` is required in the snapshot but optional in storage. `false`
    // would assert "no access" for an unknown, so drop the snapshot instead.
    ...(event.subscription && event.entitlementActive !== undefined
      ? {
          subscription: {
            state: event.subscription.state,
            productId: event.subscription.productId,
            ...(event.subscription.expiresAt !== undefined
              ? { expiresAt: event.subscription.expiresAt }
              : {}),
            ...(event.subscription.renewsAt !== undefined
              ? { renewsAt: event.subscription.renewsAt }
              : {}),
            ...(event.subscription.willRenew !== undefined
              ? { willRenew: event.subscription.willRenew }
              : {}),
            ...(event.subscription.cancellationReason
              ? { cancellationReason: event.subscription.cancellationReason }
              : {}),
            active: event.entitlementActive,
          },
        }
      : {}),
    // Same for `provenance`: a default would invent one the emitter never
    // determined, so drop the price instead.
    ...(event.currency &&
    event.amountMicros !== undefined &&
    event.amountProvenance !== undefined
      ? {
          price: {
            currency: event.currency,
            amountMicros: event.amountMicros,
            provenance: event.amountProvenance,
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
  args: {},
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
  handler: async (ctx): Promise<ClaimedDelivery[]> =>
    claimPendingDeliveriesHandler(ctx, CLAIM_BATCH_LIMIT),
});

export async function claimPendingDeliveriesHandler(
  ctx: MutationCtx,
  scanLimit: number = CLAIM_BATCH_LIMIT,
): Promise<ClaimedDelivery[]> {
  const now = Date.now();
  for (let scanned = 0; scanned < scanLimit; scanned += 1) {
    const queue = await ctx.db
      .query("outboundDeliveryQueues")
      .withIndex("by_next_claim", (q) => q.lte("nextClaimAt", now))
      .first();
    if (!queue) return [];

    // Recover an expired lease before ordinary pending work for this project.
    const stale = await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_project_and_status_and_lease_expiry", (q) =>
        q
          .eq("projectId", queue.projectId)
          .eq("status", "delivering")
          .lte("leaseExpiresAt", now),
      )
      .first();
    const due = stale
      ? null
      : await ctx.db
          .query("outboundDeliveries")
          .withIndex("by_project_and_status_and_next_attempt", (q) =>
            q
              .eq("projectId", queue.projectId)
              .eq("status", "pending")
              .lte("nextAttemptAt", now),
          )
          .first();
    const delivery = stale ?? due;
    if (!delivery) {
      const [nextPending, nextLease] = await Promise.all([
        ctx.db
          .query("outboundDeliveries")
          .withIndex("by_project_and_status_and_next_attempt", (q) =>
            q.eq("projectId", queue.projectId).eq("status", "pending"),
          )
          .first(),
        ctx.db
          .query("outboundDeliveries")
          .withIndex("by_project_and_status_and_lease_expiry", (q) =>
            q.eq("projectId", queue.projectId).eq("status", "delivering"),
          )
          .first(),
      ]);
      const future = [nextPending?.nextAttemptAt, nextLease?.leaseExpiresAt]
        .filter((value): value is number => value !== undefined)
        .sort((a, b) => a - b)[0];
      if (future === undefined) {
        // Fan-out and replay recreate this row when work appears. Keeping an
        // idle tenant in the global index forever would let old empty queues
        // consume every bounded scan ahead of newly awakened projects.
        await ctx.db.delete(queue._id);
      } else {
        await ctx.db.patch(queue._id, {
          nextClaimAt: future,
          updatedAt: now,
        });
      }
      continue;
    }

    const project = await getWritableProject(ctx, delivery.projectId);
    if (!project) {
      await ctx.db.patch(delivery._id, {
        status: "failed",
        lastError: "project unavailable",
        leaseExpiresAt: undefined,
        leaseToken: undefined,
        updatedAt: now,
      });
      await ctx.db.patch(queue._id, { nextClaimAt: now + 1, updatedAt: now });
      continue;
    }
    const destination = await ctx.db.get(delivery.destinationId);
    if (!destination || !destination.enabled || destination.pendingDeletion) {
      // Destination was disabled after the event was queued; drop the attempt
      // rather than holding a row that can never succeed.
      await ctx.db.patch(delivery._id, {
        status: "failed",
        lastError:
          delivery.attempts > 0 ? delivery.lastError : "destination disabled",
        leaseExpiresAt: undefined,
        leaseToken: undefined,
        updatedAt: now,
      });
      await ctx.db.patch(queue._id, { nextClaimAt: now + 1, updatedAt: now });
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
      await ctx.db.patch(queue._id, { nextClaimAt: now + 1, updatedAt: now });
      continue;
    }
    if (!destinationAcceptsType(destination, event.eventType)) {
      // This is an intentional administrative suppression, not a dead letter.
      // Remove the unsent row so narrowing a filter cannot create permanent
      // failed history or pin the immutable event outside retention.
      await ctx.db.delete(delivery._id);
      const remaining = await ctx.db
        .query("outboundDeliveries")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();
      if (remaining.every((row) => row.status === "delivered")) {
        await ctx.db.patch(event._id, {
          prunableAt: now + COMMERCE_EVENT_RETENTION_MS,
        });
      }
      await ctx.db.patch(queue._id, { nextClaimAt: now + 1, updatedAt: now });
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
    await ctx.db.patch(queue._id, {
      // Move this project behind every currently-due tenant. A single-project
      // queue becomes eligible again on the next mutation round trip.
      nextClaimAt: now + 1,
      updatedAt: now,
    });
    return [
      {
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
      },
    ];
  }
  return [];
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
        lastStatusCode: args.statusCode,
        lastError: undefined,
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
      lastStatusCode: args.statusCode,
      lastError: args.error ? args.error.slice(0, 500) : undefined,
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

/** Admin-safe dead-letter list; never returns signing secrets or raw bodies. */
export const listFailed = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await assertProjectAdmin(ctx, args.projectId);
    const deliveries = await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_project_and_status_and_updated", (q) =>
        q.eq("projectId", args.projectId).eq("status", "failed"),
      )
      .order("desc")
      .take(100);
    return await Promise.all(
      deliveries.map(async (delivery) => {
        const [event, destination] = await Promise.all([
          ctx.db.get(delivery.eventId),
          ctx.db.get(delivery.destinationId),
        ]);
        return {
          _id: delivery._id,
          eventId: delivery.eventId,
          eventType: event?.eventType ?? "event unavailable",
          destinationId: delivery.destinationId,
          destinationUrl: destination?.url ?? "destination unavailable",
          attempts: delivery.attempts,
          lastStatusCode: delivery.lastStatusCode,
          lastError: delivery.lastError,
          updatedAt: delivery.updatedAt,
        };
      }),
    );
  },
});

/** Project-admin replay for one dead letter. */
export const replay = mutation({
  args: { deliveryId: v.id("outboundDeliveries") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return false;
    await assertProjectAdmin(ctx, delivery.projectId);
    return replayDeliveryHandler(ctx, args.deliveryId);
  },
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
      lastStatusCode: undefined,
      lastError: undefined,
      leaseExpiresAt: undefined,
      leaseToken: undefined,
      updatedAt: now,
    });
    const queue = await ctx.db
      .query("outboundDeliveryQueues")
      .withIndex("by_project", (q) => q.eq("projectId", delivery.projectId))
      .unique();
    if (queue) {
      await ctx.db.patch(queue._id, { nextClaimAt: now, updatedAt: now });
    } else {
      await ctx.db.insert("outboundDeliveryQueues", {
        projectId: delivery.projectId,
        nextClaimAt: now,
        updatedAt: now,
      });
    }
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
    .withIndex("by_prunable_at", (q) =>
      q.gt("prunableAt", undefined).lte("prunableAt", now),
    )
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
