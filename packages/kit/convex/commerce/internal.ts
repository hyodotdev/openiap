// Emission of normalized commerce events and their outbound fan-out.
//
// `emitCommerceEvent` is a plain function, not a mutation, so callers run it
// inside the transaction that already committed the lifecycle change. That is
// what makes emission exactly-once without a second idempotency layer: if the
// transition commits, the event commits with it; if it rolls back, so does the
// event.

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { SubscriptionState } from "../webhooks/shared";
import { COMMERCE_EVENT_RETENTION_MS } from "./signing";
import {
  COMMERCE_EVENT_SCHEMA_VERSION,
  commerceEventTypeForTransition,
  commerceEventTypesToEmit,
  sanitizeExtensions,
  type CommerceEnvironment,
  type CommerceEventType,
  type LifecycleTransition,
} from "./contract";

type WebhookEnvironment = Doc<"webhookEvents">["environment"];

/** Store notification environments use TitleCase; the contract uses lowercase. */
function normalizeEnvironment(
  environment: WebhookEnvironment,
): CommerceEnvironment {
  switch (environment) {
    case "Sandbox":
      return "sandbox";
    case "Xcode":
      return "xcode";
    default:
      return "production";
  }
}

/** Inbound platform enum predates Horizon/Amazon lifecycle support. */
function storeForPlatform(
  platform: Doc<"webhookEvents">["platform"],
): "apple" | "google" {
  return platform === "IOS" ? "apple" : "google";
}

export type EmitCommerceEventArgs = {
  projectId: Id<"projects">;
  transition: LifecycleTransition | null;
  /** Entitlement gate after the transition. */
  active: boolean;
  /** Entitlement gate before it, so we can emit entitlement deltas. */
  previouslyActive: boolean;
  sourceEvent: Pick<
    Doc<"webhookEvents">,
    | "_id"
    | "platform"
    | "environment"
    | "productId"
    | "applicationId"
    | "transactionId"
    | "originalTransactionId"
    | "currency"
    | "priceAmountMicros"
    | "amountProvenance"
    | "sourceNotificationId"
    | "occurredAt"
  >;
  subscriptionId?: Id<"subscriptions">;
  previousProductId?: string;
  /** Subscription as it stands after the transition, snapshotted onto the event. */
  subscription?: {
    state: SubscriptionState;
    productId: string;
    expiresAt?: number;
    renewsAt?: number;
    willRenew?: boolean;
    cancellationReason?: string;
    userId?: string;
  };
  extensions?: Record<string, string>;
};

/**
 * Writes the lifecycle event plus any entitlement delta, then fans each out to
 * the project's enabled destinations. Returns the ids written, for tests and
 * for structured logging at the call site.
 */
export async function emitCommerceEvent(
  ctx: MutationCtx,
  args: EmitCommerceEventArgs,
): Promise<Id<"commerceEvents">[]> {
  const source = args.sourceEvent;
  const lifecycleType = commerceEventTypeForTransition(args.transition);
  const types = commerceEventTypesToEmit({
    lifecycleType,
    active: args.active,
    previouslyActive: args.previouslyActive,
    hasBoundUser: Boolean(args.subscription?.userId),
  });
  if (types.length === 0) return [];
  // Both types describe one charge, so the price rides the first only.
  // Usually the lifecycle event; the entitlement event when there is no
  // lifecycle transition, which is the only place left to carry it.
  const pricedType = types[0];

  const now = Date.now();
  const written: Id<"commerceEvents">[] = [];
  const extensions = sanitizeExtensions(args.extensions);

  for (const eventType of types) {
    // Entitlement deltas always refer to the canonical product after the
    // transition. A scheduled Apple renewal preference can put the future SKU
    // on the source event while the current entitlement remains unchanged.
    const productId = eventType.startsWith("entitlement.")
      ? (args.subscription?.productId ?? source.productId)
      : (source.productId ?? args.subscription?.productId);
    const eventId = await ctx.db.insert("commerceEvents", {
      projectId: args.projectId,
      eventType,
      eventVersion: COMMERCE_EVENT_SCHEMA_VERSION,
      store: storeForPlatform(source.platform),
      environment: normalizeEnvironment(source.environment),
      ...(args.subscription?.userId
        ? { userId: args.subscription.userId }
        : {}),
      ...(productId ? { productId } : {}),
      ...(args.previousProductId && eventType.startsWith("subscription.")
        ? { previousProductId: args.previousProductId }
        : {}),
      ...(source.applicationId ? { applicationId: source.applicationId } : {}),
      ...(source.transactionId ? { transactionId: source.transactionId } : {}),
      ...(source.originalTransactionId
        ? { originalTransactionId: source.originalTransactionId }
        : {}),
      ...(args.subscriptionId ? { subscriptionId: args.subscriptionId } : {}),
      ...(args.subscription
        ? {
            subscription: {
              state: args.subscription.state,
              productId: args.subscription.productId,
              ...(args.subscription.expiresAt !== undefined
                ? { expiresAt: args.subscription.expiresAt }
                : {}),
              ...(args.subscription.renewsAt !== undefined
                ? { renewsAt: args.subscription.renewsAt }
                : {}),
              ...(args.subscription.willRenew !== undefined
                ? { willRenew: args.subscription.willRenew }
                : {}),
              ...(args.subscription.cancellationReason
                ? { cancellationReason: args.subscription.cancellationReason }
                : {}),
            },
          }
        : {}),
      entitlementActive: args.active,
      ...(eventType === pricedType
        ? {
            ...(source.currency ? { currency: source.currency } : {}),
            ...(source.priceAmountMicros !== undefined
              ? { amountMicros: source.priceAmountMicros }
              : {}),
            // Never defaulted: "store" is the contract's authoritative value.
            ...(source.amountProvenance
              ? { amountProvenance: source.amountProvenance }
              : {}),
          }
        : {}),
      sourceEventId: source._id,
      sourceStoreNotificationId: source.sourceNotificationId,
      ...(extensions ? { extensions } : {}),
      occurredAt: source.occurredAt,
      processedAt: now,
    });
    written.push(eventId);
    const destinations = await fanOutToDestinations(
      ctx,
      args.projectId,
      eventId,
      eventType,
      now,
    );
    if (destinations === 0) {
      await ctx.db.patch(eventId, {
        prunableAt: now + COMMERCE_EVENT_RETENTION_MS,
      });
    }
  }

  return written;
}

/** One delivery row per enabled, subscribed destination. */
async function fanOutToDestinations(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  eventId: Id<"commerceEvents">,
  eventType: CommerceEventType,
  now: number,
): Promise<number> {
  const destinations = await ctx.db
    .query("outboundDestinations")
    .withIndex("by_project_and_enabled", (q) =>
      q.eq("projectId", projectId).eq("enabled", true),
    )
    .collect();

  // `eventId` was inserted by the caller moments ago, so no delivery row can
  // reference it yet — one insert per destination is already exactly-once.
  // Emission itself is protected by the surrounding transaction.
  let created = 0;
  for (const destination of destinations) {
    if (!destinationAcceptsType(destination, eventType)) continue;
    await ctx.db.insert("outboundDeliveries", {
      projectId,
      eventId,
      destinationId: destination._id,
      status: "pending",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  }
  if (created > 0) {
    const queue = await ctx.db
      .query("outboundDeliveryQueues")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();
    if (queue) {
      if (queue.nextClaimAt > now) {
        await ctx.db.patch(queue._id, { nextClaimAt: now, updatedAt: now });
      }
    } else {
      await ctx.db.insert("outboundDeliveryQueues", {
        projectId,
        nextClaimAt: now,
        updatedAt: now,
      });
    }
  }
  return created;
}

export function destinationAcceptsType(
  destination: Pick<Doc<"outboundDestinations">, "eventTypes">,
  eventType: string,
): boolean {
  const filter = destination.eventTypes;
  if (!filter || filter.length === 0) return true;
  return filter.includes(eventType);
}
