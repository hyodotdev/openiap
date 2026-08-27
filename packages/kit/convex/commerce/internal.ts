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
import {
  COMMERCE_EVENT_SCHEMA_VERSION,
  commerceEventTypeForTransition,
  sanitizeExtensions,
  type CommerceEventType,
  type DataProvenance,
  type LifecycleTransition,
} from "./contract";

type WebhookEnvironment = Doc<"webhookEvents">["environment"];
type CommerceEnvironmentValue = "production" | "sandbox" | "xcode";

/** Store notification environments use TitleCase; the contract uses lowercase. */
function normalizeEnvironment(
  environment: WebhookEnvironment,
): CommerceEnvironmentValue {
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
  sourceEvent: Doc<"webhookEvents">;
  subscriptionId?: Id<"subscriptions">;
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
  const lifecycleType = commerceEventTypeForTransition(args.transition);
  const entitlementType: CommerceEventType | null =
    args.active === args.previouslyActive
      ? null
      : args.active
        ? "entitlement.granted"
        : "entitlement.revoked";

  const types = [lifecycleType, entitlementType].filter(
    (type): type is CommerceEventType => type !== null,
  );
  if (types.length === 0) return [];

  const source = args.sourceEvent;
  const now = Date.now();
  const written: Id<"commerceEvents">[] = [];

  for (const eventType of types) {
    const amountProvenance: DataProvenance | undefined =
      source.priceAmountMicros === undefined ? undefined : "store";
    const eventId = await ctx.db.insert("commerceEvents", {
      projectId: args.projectId,
      eventType,
      eventVersion: COMMERCE_EVENT_SCHEMA_VERSION,
      store: storeForPlatform(source.platform),
      environment: normalizeEnvironment(source.environment),
      ...(args.subscription?.userId
        ? { userId: args.subscription.userId }
        : {}),
      ...(source.productId ? { productId: source.productId } : {}),
      ...(source.purchaseToken ? { transactionId: source.purchaseToken } : {}),
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
      ...(source.currency ? { currency: source.currency } : {}),
      ...(source.priceAmountMicros !== undefined
        ? { amountMicros: source.priceAmountMicros }
        : {}),
      ...(amountProvenance ? { amountProvenance } : {}),
      sourceEventId: source._id,
      sourceStoreNotificationId: source.sourceNotificationId,
      ...(sanitizeExtensions(args.extensions)
        ? { extensions: sanitizeExtensions(args.extensions) }
        : {}),
      occurredAt: source.occurredAt,
      processedAt: now,
    });
    written.push(eventId);
    await fanOutToDestinations(ctx, args.projectId, eventId, eventType, now);
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
): Promise<void> {
  const destinations = await ctx.db
    .query("outboundDestinations")
    .withIndex("by_project_and_enabled", (q) =>
      q.eq("projectId", projectId).eq("enabled", true),
    )
    .collect();

  // `eventId` was inserted by the caller moments ago, so no delivery row can
  // reference it yet — one insert per destination is already exactly-once.
  // Emission itself is protected by the surrounding transaction.
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
  }
}

export function destinationAcceptsType(
  destination: Pick<Doc<"outboundDestinations">, "eventTypes">,
  eventType: string,
): boolean {
  const filter = destination.eventTypes;
  if (!filter || filter.length === 0) return true;
  return filter.includes(eventType);
}
