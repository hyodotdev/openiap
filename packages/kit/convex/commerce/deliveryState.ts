import { assertCliScope } from "../cli/scope";
// Persistence half of outbound delivery: claim/lease, result recording and
// replay. A "use node" module may hold only actions, so the HTTP half lives in
// `delivery.ts` and calls these mutations.
//
// Direction is strictly store → IAPKit → developer backend, server to server:
// destinations are HTTPS endpoints a project owner registered, nothing here is
// reachable from a shipped app, and no client-pullable stream exists.

import {
  paginationOptsValidator,
  paginationResultValidator,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { getWritableProject } from "../projects/writable";
import {
  resolveOperatorAccess,
  resolveOperatorProject,
  type OperatorProjectArgs,
} from "../projects/helpers";
import {
  deliveryAttemptValidator,
  deliveryErrorClassValidator,
  deliveryStatusValidator,
} from "../utils/validation";
import {
  COMMERCE_EVENT_SCHEMA_VERSION,
  type CommerceEvent,
  type CommerceEventType,
} from "./contract";
import {
  CLAIM_BATCH_LIMIT,
  COMMERCE_EVENT_RETENTION_MS,
  DELIVERY_HISTORY_LIMIT,
  LEASE_MS,
  MAX_DELIVERY_ATTEMPTS,
  RESEND_LIMIT_PER_MINUTE,
  RESEND_WINDOW_MS,
  nextAttemptDelayMs,
  type DeliveryErrorClass,
} from "./signing";
import { assertProjectAdmin } from "./destinations";
import { destinationAcceptsType } from "./internal";

/** Consecutive failures before a destination is parked for manual review. */
const BREAKER_THRESHOLD = 20;
const PRUNE_BATCH_LIMIT = 200;
const MAX_DELIVERY_PAGE_SIZE = 100;

type DeliveryAttempt = Infer<typeof deliveryAttemptValidator>;

function appendDeliveryAttempt(
  history: DeliveryAttempt[] | undefined,
  attempt: DeliveryAttempt,
): DeliveryAttempt[] {
  return [...(history ?? []), attempt].slice(-DELIVERY_HISTORY_LIMIT);
}

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
 * The wire body. Typed as `CommerceEvent` so the compiler, not a test, keeps it
 * equal to the published contract: storage-only columns (`subscriptionId`, the
 * internal `sourceEventId`) cannot leak in, and no contract field can go missing.
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
        // Fan-out and replay recreate this row when work appears. Left in the
        // global index, old empty queues would use up every bounded scan ahead
        // of newly awakened projects.
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
      // A narrowed filter is an admin suppression, not a dead letter. Delete the
      // unsent row so it cannot leave permanent failed history or pin the
      // immutable event outside retention.
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

    // The lease makes overlapping cron ticks safe: a claimed row leaves
    // "pending" before the HTTP call starts. The token fences the write-back,
    // so a reclaimed row ignores what the superseded attempt reports.
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
  latencyMs?: number;
  error?: string;
  errorClass?: DeliveryErrorClass;
  retryable: boolean;
};

export const recordDeliveryResult = internalMutation({
  args: {
    deliveryId: v.id("outboundDeliveries"),
    leaseToken: v.string(),
    ok: v.boolean(),
    statusCode: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    error: v.optional(v.string()),
    errorClass: v.optional(deliveryErrorClassValidator),
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
    const exhausted =
      !args.ok && (attempts >= MAX_DELIVERY_ATTEMPTS || !args.retryable);
    const attemptHistory = appendDeliveryAttempt(delivery.attemptHistory, {
      at: now,
      outcome: args.ok ? "delivered" : exhausted ? "failed" : "retrying",
      ...(args.statusCode !== undefined ? { statusCode: args.statusCode } : {}),
      ...(args.latencyMs !== undefined ? { latencyMs: args.latencyMs } : {}),
      ...(args.errorClass ? { errorClass: args.errorClass } : {}),
    });

    if (args.ok) {
      await ctx.db.patch(delivery._id, {
        status: "delivered",
        attempts,
        deliveredAt: now,
        leaseExpiresAt: undefined,
        leaseToken: undefined,
        lastStatusCode: args.statusCode,
        lastError: undefined,
        attemptHistory,
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
      attemptHistory,
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
    await assertCliScope(ctx, "read");
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

/**
 * Project-admin replay for one dead letter. Kept for existing callers; it runs
 * the same bounded path as `resend`.
 */
export const replay = mutation({
  args: { deliveryId: v.id("outboundDeliveries") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "write");
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return false;
    await assertProjectAdmin(ctx, delivery.projectId);
    if (delivery.status !== "failed") return false;
    await resendDeliveryHandler(ctx, { deliveryId: args.deliveryId });
    return true;
  },
});

export async function replayDeliveryHandler(
  ctx: MutationCtx,
  deliveryId: Id<"outboundDeliveries">,
): Promise<boolean> {
  const delivery = await ctx.db.get(deliveryId);
  if (!delivery || delivery.status !== "failed") return false;
  await requeueDelivery(ctx, delivery, {});
  return true;
}

/** Puts a row back in the claim queue with a fresh attempt budget. */
async function requeueDelivery(
  ctx: MutationCtx,
  delivery: Doc<"outboundDeliveries">,
  extra: Pick<Partial<Doc<"outboundDeliveries">>, "lastResendAt">,
): Promise<void> {
  const now = Date.now();
  await ctx.db.patch(delivery._id, {
    status: "pending",
    attempts: 0,
    nextAttemptAt: now,
    lastStatusCode: undefined,
    lastError: undefined,
    deliveredAt: undefined,
    leaseExpiresAt: undefined,
    leaseToken: undefined,
    ...extra,
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
}

/**
 * Admin re-send of a delivered or dead-lettered row. The body keeps the same
 * `eventId`, so receivers that dedupe on it treat the copy as a duplicate.
 */
export const resend = mutation({
  args: { deliveryId: v.string(), apiKey: v.optional(v.string()) },
  returns: v.object({
    deliveryId: v.id("outboundDeliveries"),
    eventId: v.id("commerceEvents"),
    status: v.literal("pending"),
  }),
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "write");
    return resendDeliveryHandler(ctx, args);
  },
});

export async function resendDeliveryHandler(
  ctx: MutationCtx,
  args: { deliveryId: string; apiKey?: string },
): Promise<{
  deliveryId: Id<"outboundDeliveries">;
  eventId: Id<"commerceEvents">;
  status: "pending";
}> {
  const deliveryId = ctx.db.normalizeId("outboundDeliveries", args.deliveryId);
  const delivery = deliveryId ? await ctx.db.get(deliveryId) : null;
  const notFound = new ConvexError({
    code: "NOT_FOUND",
    message:
      "Delivery not found. Delivered rows and their events are kept for 30 days.",
  });
  if (!delivery) throw notFound;
  const project = await resolveOperatorProject(
    ctx,
    { apiKey: args.apiKey, projectId: delivery.projectId },
    "write",
  );
  if (project._id !== delivery.projectId) throw notFound;
  if (delivery.status !== "delivered" && delivery.status !== "failed") {
    throw new ConvexError({
      code: "NOT_RESENDABLE",
      message:
        "This delivery is already queued. Wait for the current attempt to finish.",
    });
  }
  const event = await ctx.db.get(delivery.eventId);
  if (!event) {
    throw new ConvexError({
      code: "EVENT_PRUNED",
      message:
        "The commerce event passed its 30-day retention and was pruned, so it can no longer be re-sent.",
    });
  }
  const destination = await ctx.db.get(delivery.destinationId);
  if (!destination || !destination.enabled || destination.pendingDeletion) {
    throw new ConvexError({
      code: "DESTINATION_DISABLED",
      message: "Enable the destination before re-sending to it.",
    });
  }
  if (!destinationAcceptsType(destination, event.eventType)) {
    throw new ConvexError({
      code: "EVENT_TYPE_FILTERED",
      message: `The destination no longer subscribes to ${event.eventType}.`,
    });
  }

  const now = Date.now();
  const windowStart = now - RESEND_WINDOW_MS;
  const retryAfterSec = (since: number): number =>
    Math.max(1, Math.ceil((since + RESEND_WINDOW_MS - now) / 1_000));
  if (
    delivery.lastResendAt !== undefined &&
    delivery.lastResendAt > windowStart
  ) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: "This delivery was re-sent less than a minute ago.",
      retryAfterSec: retryAfterSec(delivery.lastResendAt),
    });
  }
  // Oldest first, so the first row tells when the window frees a slot.
  const recent = await ctx.db
    .query("outboundDeliveries")
    .withIndex("by_project_and_last_resend", (q) =>
      q.eq("projectId", project._id).gt("lastResendAt", windowStart),
    )
    .take(RESEND_LIMIT_PER_MINUTE);
  if (recent.length >= RESEND_LIMIT_PER_MINUTE) {
    throw new ConvexError({
      code: "RATE_LIMITED",
      message: `A project can re-send at most ${RESEND_LIMIT_PER_MINUTE} deliveries per minute.`,
      retryAfterSec: retryAfterSec(recent[0].lastResendAt ?? now),
    });
  }

  await requeueDelivery(ctx, delivery, { lastResendAt: now });
  return { deliveryId: delivery._id, eventId: event._id, status: "pending" };
}

const deliveryViewValidator = v.object({
  _id: v.id("outboundDeliveries"),
  eventId: v.id("commerceEvents"),
  eventType: v.string(),
  eventAvailable: v.boolean(),
  destinationId: v.id("outboundDestinations"),
  // Host only: a destination URL can carry a receiver token, and the full URL
  // is admin-only.
  destinationHost: v.string(),
  // Owners, admins and secret keys only, like the URL it describes.
  destinationDescription: v.optional(v.string()),
  status: deliveryStatusValidator,
  resendable: v.boolean(),
  attempts: v.number(),
  nextAttemptAt: v.number(),
  lastStatusCode: v.optional(v.number()),
  // The receiver's error text can name hosts and addresses, so only owners,
  // admins and secret keys get it; everyone gets the latest attempt's class.
  lastError: v.optional(v.string()),
  lastErrorClass: v.optional(deliveryErrorClassValidator),
  deliveredAt: v.optional(v.number()),
  lastResendAt: v.optional(v.number()),
  attemptHistory: v.array(deliveryAttemptValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});
export type DeliveryView = Infer<typeof deliveryViewValidator>;

export type ListDeliveriesArgs = OperatorProjectArgs & {
  status?: Doc<"outboundDeliveries">["status"];
  eventType?: string;
  destinationId?: string;
  eventId?: string;
  paginationOpts: PaginationOptions;
};

/** Delivery history for members and secret keys, newest first. */
export const listDeliveries = query({
  args: {
    projectId: v.optional(v.id("projects")),
    apiKey: v.optional(v.string()),
    status: v.optional(deliveryStatusValidator),
    eventType: v.optional(v.string()),
    destinationId: v.optional(v.string()),
    eventId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(deliveryViewValidator),
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    return listDeliveriesHandler(ctx, args);
  },
});

export async function listDeliveriesHandler(
  ctx: QueryCtx,
  args: ListDeliveriesArgs,
): Promise<PaginationResult<DeliveryView>> {
  const { project, adminView } = await resolveOperatorAccess(ctx, args, "read");
  if (args.paginationOpts.numItems > MAX_DELIVERY_PAGE_SIZE) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: `A page holds at most ${MAX_DELIVERY_PAGE_SIZE} deliveries.`,
    });
  }
  const empty: PaginationResult<DeliveryView> = {
    page: [],
    isDone: true,
    continueCursor: "",
  };
  const { status, eventType } = args;

  // Every filter combination has its own index, so a page never scans rows it
  // drops. An event has one delivery per destination, so that filter is small.
  let rows: PaginationResult<Doc<"outboundDeliveries">>;
  if (args.eventId !== undefined) {
    const eventId = ctx.db.normalizeId("commerceEvents", args.eventId);
    const destinationId =
      args.destinationId === undefined
        ? undefined
        : ctx.db.normalizeId("outboundDestinations", args.destinationId);
    if (!eventId || destinationId === null) return empty;
    rows = await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .order("desc")
      .filter((q) =>
        q.and(
          q.eq(q.field("projectId"), project._id),
          status === undefined ? true : q.eq(q.field("status"), status),
          destinationId === undefined
            ? true
            : q.eq(q.field("destinationId"), destinationId),
          eventType === undefined
            ? true
            : q.eq(q.field("eventType"), eventType),
        ),
      )
      .paginate(args.paginationOpts);
  } else if (args.destinationId !== undefined) {
    const destinationId = ctx.db.normalizeId(
      "outboundDestinations",
      args.destinationId,
    );
    const destination = destinationId ? await ctx.db.get(destinationId) : null;
    if (!destination || destination.projectId !== project._id) return empty;
    const deliveries = ctx.db.query("outboundDeliveries");
    rows = await (
      eventType !== undefined && status !== undefined
        ? deliveries.withIndex(
            "by_destination_and_event_type_and_status",
            (q) =>
              q
                .eq("destinationId", destination._id)
                .eq("eventType", eventType)
                .eq("status", status),
          )
        : eventType !== undefined
          ? deliveries.withIndex("by_destination_and_event_type", (q) =>
              q.eq("destinationId", destination._id).eq("eventType", eventType),
            )
          : status !== undefined
            ? deliveries.withIndex("by_destination_and_status", (q) =>
                q.eq("destinationId", destination._id).eq("status", status),
              )
            : deliveries.withIndex("by_destination", (q) =>
                q.eq("destinationId", destination._id),
              )
    )
      .order("desc")
      .paginate(args.paginationOpts);
  } else if (eventType !== undefined) {
    const deliveries = ctx.db.query("outboundDeliveries");
    rows = await (
      status !== undefined
        ? deliveries.withIndex("by_project_and_event_type_and_status", (q) =>
            q
              .eq("projectId", project._id)
              .eq("eventType", eventType)
              .eq("status", status),
          )
        : deliveries.withIndex("by_project_and_event_type", (q) =>
            q.eq("projectId", project._id).eq("eventType", eventType),
          )
    )
      .order("desc")
      .paginate(args.paginationOpts);
  } else if (status !== undefined) {
    rows = await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_project_and_status_and_updated", (q) =>
        q.eq("projectId", project._id).eq("status", status),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  } else {
    rows = await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .order("desc")
      .paginate(args.paginationOpts);
  }

  const destinations = new Map<
    Id<"outboundDestinations">,
    Promise<Doc<"outboundDestinations"> | null>
  >();
  const page = await Promise.all(
    rows.page.map(async (delivery): Promise<DeliveryView> => {
      if (!destinations.has(delivery.destinationId)) {
        destinations.set(
          delivery.destinationId,
          ctx.db.get(delivery.destinationId),
        );
      }
      const [destination, event] = await Promise.all([
        destinations.get(delivery.destinationId)!,
        ctx.db.get(delivery.eventId),
      ]);
      const resendable =
        (delivery.status === "delivered" || delivery.status === "failed") &&
        event !== null &&
        destination !== null &&
        destination.enabled &&
        !destination.pendingDeletion &&
        destinationAcceptsType(destination, event.eventType);
      const lastErrorClass = delivery.attemptHistory?.at(-1)?.errorClass;
      return {
        _id: delivery._id,
        eventId: delivery.eventId,
        eventType: delivery.eventType ?? event?.eventType ?? "unknown",
        eventAvailable: event !== null,
        destinationId: delivery.destinationId,
        destinationHost: destination ? hostOf(destination.url) : "removed",
        ...(adminView && destination?.description
          ? { destinationDescription: destination.description }
          : {}),
        status: delivery.status,
        resendable,
        attempts: delivery.attempts,
        nextAttemptAt: delivery.nextAttemptAt,
        ...(delivery.lastStatusCode !== undefined
          ? { lastStatusCode: delivery.lastStatusCode }
          : {}),
        ...(adminView && delivery.lastError
          ? { lastError: delivery.lastError }
          : {}),
        ...(lastErrorClass ? { lastErrorClass } : {}),
        ...(delivery.deliveredAt !== undefined
          ? { deliveredAt: delivery.deliveredAt }
          : {}),
        ...(delivery.lastResendAt !== undefined
          ? { lastResendAt: delivery.lastResendAt }
          : {}),
        attemptHistory: delivery.attemptHistory ?? [],
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
      };
    }),
  );
  return { ...rows, page };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid URL";
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
