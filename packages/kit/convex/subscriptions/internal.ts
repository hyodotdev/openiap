import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import {
  applySubscriptionTransition,
  entitlementActive,
  type CurrentSubscription,
  type SubscriptionEventInput,
} from "./stateMachine";
import { applyStatsTransition, statsContributionFor } from "./stats";
import { assertProjectWritable } from "../projects/writable";
import { isValidSubscriptionUserId } from "./limits";

export const USER_ERASURE_BATCH_SIZE = 100;
export const USER_ERASURE_JOB_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const USER_ERASURE_STALE_MS = 10 * 60 * 1_000;
const USER_ERASURE_PRUNER_BATCH_SIZE = 100;

const subscriptionPlatformValidator = v.union(
  v.literal("IOS"),
  v.literal("Android"),
);

type RawEventInput = Pick<
  Doc<"webhookEvents">,
  | "type"
  | "productId"
  | "subscriptionState"
  | "expiresAt"
  | "renewsAt"
  | "willRenew"
  | "cancellationReason"
  | "currency"
  | "priceAmountMicros"
  | "platform"
  | "effectiveImmediately"
> & { purchaseToken: string };
type SubscriptionState = Doc<"subscriptions">["state"];
type SubscriptionCancellationReason = NonNullable<
  Doc<"subscriptions">["cancellationReason"]
>;
type SubscriptionPlatform = Doc<"subscriptions">["platform"];

export type VerifiedSubscriptionInput = {
  platform: SubscriptionPlatform;
  productId: string;
  purchaseState: HarmonizedPurchaseState;
  subscriptionState?: string;
  expiresAt?: number;
  renewsAt?: number;
  willRenew?: boolean;
  currency?: string;
  priceAmountMicros?: number;
  revocationReasonIOS?: number;
};

export type VerifiedSubscriptionSnapshot = {
  productId: string;
  state: SubscriptionState;
  expiresAt?: number;
  renewsAt?: number;
  willRenew?: boolean;
  cancellationReason?: SubscriptionCancellationReason;
  clearCancellationReason?: boolean;
  currency?: string;
  priceAmountMicros?: number;
};

type ExistingSubscriptionSnapshotFields = Pick<
  Doc<"subscriptions">,
  | "expiresAt"
  | "renewsAt"
  | "willRenew"
  | "cancellationReason"
  | "currency"
  | "priceAmountMicros"
>;

type RecordVerifiedSubscriptionArgs = {
  projectId: Id<"projects">;
  platform: SubscriptionPlatform;
  purchaseToken: string;
  productId: string;
  purchaseState: string;
  subscriptionState?: string;
  expiresAt?: number;
  renewsAt?: number;
  willRenew?: boolean;
  currency?: string;
  priceAmountMicros?: number;
  revocationReasonIOS?: number;
};

type BindSubscriptionToUserArgs = {
  projectId: Id<"projects">;
  purchaseToken: string;
  userId: string;
};

interface PersistSubscriptionSnapshotArgs {
  projectId: Id<"projects">;
  platform: SubscriptionPlatform;
  purchaseToken: string;
  existing: Doc<"subscriptions"> | null;
  next: NonNullable<CurrentSubscription>;
  now: number;
  lastEvent?: Pick<
    Doc<"webhookEvents">,
    | "_id"
    | "_creationTime"
    | "type"
    | "occurredAt"
    | "sourceNotificationId"
    | "environment"
    | "productId"
    | "applicationId"
    | "transactionId"
    | "originalTransactionId"
    | "currency"
    | "priceAmountMicros"
  >;
}

interface ApplySubscriptionEventArgs {
  projectId: Id<"projects">;
  eventId: Id<"webhookEvents">;
}

interface ApplySubscriptionEventResult {
  transition: string | null;
  active: boolean;
  subscriptionId?: Id<"subscriptions">;
}

// Apply a webhook event to the canonical `subscriptions` table. The event's
// durable appliedAt marker is committed in the same Convex transaction as
// the subscription and stats writes, so both retry gaps are safe: a crash
// before this mutation can be repaired, while any event this mutation already
// processed can never be replayed after a newer lastEventId replaces it.
import { emitCommerceEvent } from "../commerce/internal";

export const applySubscriptionEvent = internalMutation({
  args: {
    projectId: v.id("projects"),
    eventId: v.id("webhookEvents"),
  },
  returns: v.object({
    transition: v.union(v.string(), v.null()),
    active: v.boolean(),
    subscriptionId: v.optional(v.id("subscriptions")),
  }),
  handler: async (ctx, args) => applySubscriptionEventHandler(ctx, args),
});

export async function applySubscriptionEventHandler(
  ctx: MutationCtx,
  args: ApplySubscriptionEventArgs,
): Promise<ApplySubscriptionEventResult> {
  await assertProjectWritable(ctx, args.projectId);
  const storedEvent = await ctx.db.get(args.eventId);
  if (!storedEvent || storedEvent.projectId !== args.projectId) {
    throw new Error("Webhook event not found for project");
  }

  const now = Date.now();
  if (storedEvent.productKind === "one_time") {
    if (storedEvent.appliedAt === undefined) {
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
    }
    return { transition: null, active: false };
  }
  if (!storedEvent.purchaseToken) {
    if (storedEvent.appliedAt === undefined) {
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
    }
    return { transition: null, active: false };
  }

  const supersedingResolution = await findSupersedingSubscription(
    ctx,
    args.projectId,
    storedEvent.purchaseToken,
  );
  const existingByCurrentToken = supersedingResolution.aliased
    ? null
    : await findSubscriptionByToken(
        ctx,
        args.projectId,
        storedEvent.purchaseToken,
      );
  if (supersedingResolution.aliased) {
    const supersedingSubscription = supersedingResolution.subscription;
    const aliasedTransition =
      storedEvent.type === "PurchaseRefunded"
        ? ("Refunded" as const)
        : storedEvent.type === "SubscriptionRevoked"
          ? ("Revoked" as const)
          : null;
    const active = supersedingSubscription
      ? isActive(supersedingSubscription, now)
      : false;
    const firstApplication = storedEvent.appliedAt === undefined;
    if (firstApplication) {
      if (supersedingSubscription && aliasedTransition) {
        const predecessorProductId =
          storedEvent.productId ?? supersedingResolution.productId;
        await emitCommerceEvent(ctx, {
          projectId: args.projectId,
          transition: aliasedTransition,
          active: false,
          previouslyActive: false,
          sourceEvent: {
            ...storedEvent,
            productId: predecessorProductId,
          },
          ...(predecessorProductId
            ? {
                subscription: {
                  state: aliasedTransition,
                  productId: predecessorProductId,
                  ...(supersedingSubscription.userId
                    ? { userId: supersedingSubscription.userId }
                    : {}),
                },
              }
            : {}),
        });
      }
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
    }
    return {
      transition: firstApplication ? aliasedTransition : null,
      active,
      ...(supersedingSubscription
        ? { subscriptionId: supersedingSubscription._id }
        : {}),
    };
  }
  const linkedResolution = storedEvent.linkedPurchaseToken
    ? await findSupersedingSubscription(
        ctx,
        args.projectId,
        storedEvent.linkedPurchaseToken,
      )
    : ({ aliased: false } as const);
  const linkedExact =
    storedEvent.linkedPurchaseToken && !linkedResolution.aliased
      ? await findSubscriptionByToken(
          ctx,
          args.projectId,
          storedEvent.linkedPurchaseToken,
        )
      : null;
  if (linkedResolution.aliased && !linkedResolution.subscription) {
    if (storedEvent.appliedAt === undefined) {
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
    }
    return { transition: null, active: false };
  }
  const linkedExisting =
    linkedExact ??
    (linkedResolution.aliased ? linkedResolution.subscription : null);
  let existing = preferredReplacementSnapshot(
    existingByCurrentToken,
    linkedExisting,
  );
  const priorStoreSnapshot = existingByCurrentToken?.lastEventId
    ? existingByCurrentToken
    : linkedExisting?.lastEventId
      ? linkedExisting
      : null;
  if (storedEvent.appliedAt !== undefined) {
    return {
      transition: null,
      active: existing ? isActive(existing, now) : false,
      ...(existing ? { subscriptionId: existing._id } : {}),
    };
  }

  // A linked-token event can arrive after both tokens already have rows. Keep
  // current-token state, merge predecessor identity/history, and remove the
  // duplicate contribution before applying same-token ordering.
  if (
    existingByCurrentToken &&
    linkedExisting &&
    existingByCurrentToken._id !== linkedExisting._id
  ) {
    if (
      existingByCurrentToken.userId &&
      linkedExisting.userId &&
      existingByCurrentToken.userId !== linkedExisting.userId
    ) {
      throw new ConvexError({
        code: "SUBSCRIPTION_USER_CONFLICT",
        message: "Linked Google purchase tokens belong to different users.",
      });
    }
    const survivor = preferredReplacementSnapshot(
      existingByCurrentToken,
      linkedExisting,
    )!;
    const removed =
      survivor._id === existingByCurrentToken._id
        ? linkedExisting
        : existingByCurrentToken;
    const removedPeriod = await fetchBillingPeriod(
      ctx,
      args.projectId,
      removed.platform,
      removed.productId,
    );
    await applyStatsTransition(
      ctx,
      args.projectId,
      statsContributionFor(removed, removedPeriod, now),
      null,
    );
    await ctx.db.delete(removed._id);
    existing = {
      ...survivor,
      purchaseToken: storedEvent.purchaseToken,
      userId: survivor.userId ?? removed.userId,
      startedAt: Math.min(survivor.startedAt, removed.startedAt),
    };
    await ctx.db.patch(survivor._id, {
      purchaseToken: existing.purchaseToken,
      userId: existing.userId,
      startedAt: existing.startedAt,
      updatedAt: now,
    });
    await recordSubscriptionTokenAlias(ctx, {
      projectId: args.projectId,
      purchaseToken: removed.purchaseToken,
      successorPurchaseToken: existing.purchaseToken,
      predecessorProductId: removed.productId,
      now,
    });
  }

  // Captured before any transition so entitlement deltas are emitted from the
  // pre-event gate, not the post-event one. A verification-only snapshot has
  // not produced an outbound entitlement event yet.
  const previouslyActive = priorStoreSnapshot
    ? isActive(priorStoreSnapshot, now)
    : false;
  const noOpResult = (): ApplySubscriptionEventResult => ({
    transition: null,
    active: existing ? isActive(existing, now) : false,
    ...(existing ? { subscriptionId: existing._id } : {}),
  });

  // Store timestamps only order events for the same purchase token. A linked
  // predecessor can expire after its replacement became active.
  const orderingExisting = existingByCurrentToken;

  // Rollout compatibility for events written before appliedAt existed. The
  // current last event proves itself applied; an event older than the current
  // last event must be marked handled without being allowed to roll state
  // backwards. Store timestamps are only millisecond-precision, so ingestion
  // order breaks ties between distinct same-timestamp events. A recorded-but-
  // unapplied newest event still falls through and repairs the original
  // action/mutation gap.
  if (
    orderingExisting?.lastEventSourceNotificationId ===
    storedEvent.sourceNotificationId
  ) {
    await ctx.db.patch(storedEvent._id, { appliedAt: now });
    return noOpResult();
  }
  if (orderingExisting?.lastEventOccurredAt !== undefined) {
    const stale =
      orderingExisting.lastEventOccurredAt > storedEvent.occurredAt ||
      (orderingExisting.lastEventOccurredAt === storedEvent.occurredAt &&
        (orderingExisting.lastEventCreationTime ?? 0) >
          storedEvent._creationTime);
    if (stale) {
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
      return noOpResult();
    }
  } else if (orderingExisting?.lastEventId) {
    if (orderingExisting.lastEventId === args.eventId) {
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
      return noOpResult();
    }
    const lastEvent = await ctx.db.get(orderingExisting.lastEventId);
    if (
      lastEvent?.projectId === args.projectId &&
      lastEvent.purchaseToken === storedEvent.purchaseToken &&
      lastEvent.platform === storedEvent.platform &&
      (lastEvent.occurredAt > storedEvent.occurredAt ||
        (lastEvent.occurredAt === storedEvent.occurredAt &&
          lastEvent._creationTime > storedEvent._creationTime))
    ) {
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
      return noOpResult();
    }
  }

  // Google subscription bundles can report ITEMS_CHANGED without identifying
  // which line item changed. Keep the raw event for operations, but never
  // overwrite the singular canonical product with an arbitrary bundle item.
  // Linked replacements still move the canonical row after the ordering guard.
  if (
    storedEvent.type === "SubscriptionProductChanged" &&
    !storedEvent.productId
  ) {
    if (existing) {
      const verifiedReplacementProductChanged =
        existingByCurrentToken?.lastEventId === undefined &&
        priorStoreSnapshot !== null &&
        priorStoreSnapshot.productId !== existing.productId;
      const subscriptionId = await persistSubscriptionSnapshot(ctx, {
        projectId: args.projectId,
        platform: existing.platform,
        purchaseToken: storedEvent.purchaseToken,
        existing,
        next: {
          state: existing.state,
          productId: existing.productId,
          expiresAt: existing.expiresAt,
          renewsAt: existing.renewsAt,
          willRenew: existing.willRenew,
          cancellationReason: existing.cancellationReason,
          currency: existing.currency,
          priceAmountMicros: existing.priceAmountMicros,
        },
        now,
        lastEvent: storedEvent,
      });
      await recordSubscriptionTokenAlias(ctx, {
        projectId: args.projectId,
        purchaseToken: existing.purchaseToken,
        successorPurchaseToken: storedEvent.purchaseToken,
        predecessorProductId: existing.productId,
        now,
      });
      await recordSubscriptionTokenAlias(ctx, {
        projectId: args.projectId,
        purchaseToken: storedEvent.linkedPurchaseToken,
        successorPurchaseToken: storedEvent.purchaseToken,
        predecessorProductId:
          priorStoreSnapshot?.productId ?? existing.productId,
        now,
      });
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
      const active = isActive(existing, now);
      if (verifiedReplacementProductChanged) {
        await emitCommerceEvent(ctx, {
          projectId: args.projectId,
          transition: "ProductChanged",
          active,
          previouslyActive: active,
          sourceEvent: storedEvent,
          subscriptionId,
          previousProductId: priorStoreSnapshot.productId,
          subscription: {
            state: existing.state,
            productId: existing.productId,
            ...(existing.expiresAt !== undefined
              ? { expiresAt: existing.expiresAt }
              : {}),
            ...(existing.renewsAt !== undefined
              ? { renewsAt: existing.renewsAt }
              : {}),
            ...(existing.willRenew !== undefined
              ? { willRenew: existing.willRenew }
              : {}),
            ...(existing.cancellationReason
              ? { cancellationReason: existing.cancellationReason }
              : {}),
            ...(existing.userId ? { userId: existing.userId } : {}),
          },
        });
      }
      return {
        transition: verifiedReplacementProductChanged ? "ProductChanged" : null,
        active,
        subscriptionId,
      };
    }
    await ctx.db.patch(storedEvent._id, { appliedAt: now });
    return noOpResult();
  }

  const current: CurrentSubscription = existing
    ? {
        state: existing.state,
        productId: existing.productId,
        expiresAt: existing.expiresAt,
        renewsAt: existing.renewsAt,
        willRenew: existing.willRenew,
        cancellationReason: existing.cancellationReason,
        currency: existing.currency,
        priceAmountMicros: existing.priceAmountMicros,
      }
    : null;
  const event: RawEventInput = {
    type: storedEvent.type,
    productId: storedEvent.productId,
    subscriptionState: storedEvent.subscriptionState,
    expiresAt: storedEvent.expiresAt,
    renewsAt: storedEvent.renewsAt,
    willRenew: storedEvent.willRenew,
    cancellationReason: storedEvent.cancellationReason,
    currency: storedEvent.currency,
    priceAmountMicros: storedEvent.priceAmountMicros,
    platform: storedEvent.platform,
    effectiveImmediately: storedEvent.effectiveImmediately,
    purchaseToken: storedEvent.purchaseToken,
  };
  const transition = applySubscriptionTransition(
    current,
    coerceEventInput(event),
  );
  const linkedStartedOnActivePredecessor =
    storedEvent.type === "SubscriptionStarted" &&
    storedEvent.linkedPurchaseToken !== undefined &&
    priorStoreSnapshot !== null &&
    previouslyActive;
  const effectiveTransition = linkedStartedOnActivePredecessor
    ? transition.next?.productId !== priorStoreSnapshot.productId
      ? "ProductChanged"
      : priorStoreSnapshot.willRenew === false &&
          transition.next?.willRenew === true
        ? "Uncanceled"
        : transition.next?.expiresAt !== undefined &&
            priorStoreSnapshot.expiresAt !== undefined &&
            transition.next.expiresAt > priorStoreSnapshot.expiresAt
          ? "Renewed"
          : null
    : transition.transition;
  const firstStoreEventAfterVerification =
    storedEvent.type === "SubscriptionStarted" &&
    existing !== null &&
    existing.lastEventId === undefined &&
    priorStoreSnapshot === null;
  // Computed before persistSubscriptionSnapshot stamps lastEvent* onto the
  // row: a record bootstrapped by receipt verification has no store history,
  // so a price change or deferral arriving as its first store event has no
  // baseline to describe. The mapping vectors pin these to no event.
  const priceOrDeferralWithoutBaseline =
    existing !== null &&
    existing.lastEventId === undefined &&
    priorStoreSnapshot === null &&
    (effectiveTransition === "PriceChanged" ||
      effectiveTransition === "Deferred");
  const previousProductId =
    priorStoreSnapshot?.productId ?? existing?.productId;

  if (!transition.next) {
    await ctx.db.patch(storedEvent._id, { appliedAt: now });
    return {
      transition: transition.transition ?? null,
      active: false,
      ...(existing ? { subscriptionId: existing._id } : {}),
    };
  }

  const subscriptionId = await persistSubscriptionSnapshot(ctx, {
    projectId: args.projectId,
    platform: event.platform,
    purchaseToken: event.purchaseToken,
    existing,
    next: transition.next,
    now,
    lastEvent: storedEvent,
  });
  await recordSubscriptionTokenAlias(ctx, {
    projectId: args.projectId,
    purchaseToken: existing?.purchaseToken,
    successorPurchaseToken: storedEvent.purchaseToken,
    predecessorProductId: existing?.productId,
    now,
  });
  await recordSubscriptionTokenAlias(ctx, {
    projectId: args.projectId,
    purchaseToken: storedEvent.linkedPurchaseToken,
    successorPurchaseToken: storedEvent.purchaseToken,
    predecessorProductId: priorStoreSnapshot?.productId ?? existing?.productId,
    now,
  });
  await ctx.db.patch(storedEvent._id, { appliedAt: now });
  const active = entitlementActive(transition.next, now);
  // A record bootstrapped by receipt verification has no store history, so a
  // price change or deferral arriving as its first store event has no
  // baseline to describe. The mapping vectors pin these to no event.
  const commerceTransition = linkedStartedOnActivePredecessor
    ? effectiveTransition
    : firstStoreEventAfterVerification
      ? "Started"
      : priceOrDeferralWithoutBaseline
        ? null
        : effectiveTransition;
  await emitCommerceEvent(ctx, {
    projectId: args.projectId,
    transition: commerceTransition ?? null,
    active,
    previouslyActive,
    sourceEvent: storedEvent,
    subscriptionId,
    ...(previousProductId && previousProductId !== transition.next.productId
      ? { previousProductId }
      : {}),
    subscription: {
      state: transition.next.state,
      productId: transition.next.productId,
      ...(transition.next.expiresAt !== undefined
        ? { expiresAt: transition.next.expiresAt }
        : {}),
      ...(transition.next.renewsAt !== undefined
        ? { renewsAt: transition.next.renewsAt }
        : {}),
      ...(transition.next.willRenew !== undefined
        ? { willRenew: transition.next.willRenew }
        : {}),
      ...(transition.next.cancellationReason
        ? { cancellationReason: transition.next.cancellationReason }
        : {}),
      ...(existing?.userId ? { userId: existing.userId } : {}),
    },
  });

  return {
    transition: effectiveTransition ?? null,
    active,
    subscriptionId,
  };
}

export function buildVerifiedSubscriptionSnapshot(
  input: VerifiedSubscriptionInput,
): VerifiedSubscriptionSnapshot | null {
  if (input.productId.length === 0 || input.productId === "unknown") {
    return null;
  }
  if (input.purchaseState === HarmonizedPurchaseState.INAUTHENTIC) return null;

  const base: Pick<
    VerifiedSubscriptionSnapshot,
    | "productId"
    | "expiresAt"
    | "renewsAt"
    | "willRenew"
    | "currency"
    | "priceAmountMicros"
  > = {
    productId: input.productId,
    expiresAt: input.expiresAt,
    renewsAt: input.renewsAt,
    willRenew: input.willRenew,
    currency: input.currency,
    priceAmountMicros: input.priceAmountMicros,
  };

  if (input.platform === "IOS") {
    switch (input.purchaseState) {
      case HarmonizedPurchaseState.ENTITLED:
        return {
          ...base,
          state: "Active",
          cancellationReason: undefined,
          clearCancellationReason: true,
        };
      case HarmonizedPurchaseState.EXPIRED:
        return {
          ...base,
          state: "Expired",
          willRenew: false,
        };
      case HarmonizedPurchaseState.CANCELED:
        return {
          ...base,
          state: "Revoked",
          willRenew: false,
          // Apple's revocationReason field covers a transaction "refunded
          // ... or revoked from family sharing": value 1 is unambiguously a
          // refund, while 0 also covers Family Sharing loss. Mirroring the
          // webhook REVOKE policy, only the unambiguous value asserts money
          // moved back; webhook REFUND notifications carry the rest.
          ...(input.revocationReasonIOS === 1
            ? { cancellationReason: "Refunded" as const }
            : {}),
        };
      case HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT:
      case HarmonizedPurchaseState.PENDING:
      case HarmonizedPurchaseState.UNKNOWN:
        return {
          ...base,
          state: "Unknown",
        };
      case HarmonizedPurchaseState.READY_TO_CONSUME:
      case HarmonizedPurchaseState.CONSUMED:
        return null;
    }
  }

  switch (input.purchaseState) {
    case HarmonizedPurchaseState.UNKNOWN:
      return {
        ...base,
        state: "Unknown",
      };
    case HarmonizedPurchaseState.EXPIRED:
      return {
        ...base,
        state: "Expired",
        willRenew: false,
      };
    case HarmonizedPurchaseState.READY_TO_CONSUME:
    case HarmonizedPurchaseState.CONSUMED:
      return null;
    case HarmonizedPurchaseState.ENTITLED:
    case HarmonizedPurchaseState.CANCELED:
      break;
  }

  switch (input.subscriptionState?.toUpperCase()) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return {
        ...base,
        state: "Active",
        willRenew: input.willRenew ?? true,
        cancellationReason: undefined,
        clearCancellationReason: true,
      };
    case "SUBSCRIPTION_STATE_CANCELED":
      return {
        ...base,
        state: "Active",
        willRenew: false,
      };
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return {
        ...base,
        state: "InGracePeriod",
        willRenew: input.willRenew ?? true,
        cancellationReason: undefined,
        clearCancellationReason: true,
      };
    case "SUBSCRIPTION_STATE_ON_HOLD":
      return {
        ...base,
        state: "InBillingRetry",
        cancellationReason: "BillingError",
      };
    case "SUBSCRIPTION_STATE_PAUSED":
      return {
        ...base,
        state: "Paused",
        willRenew: false,
      };
    case "SUBSCRIPTION_STATE_EXPIRED":
      return {
        ...base,
        state: "Expired",
        willRenew: false,
      };
    case "SUBSCRIPTION_STATE_PENDING":
      return {
        ...base,
        state: "Unknown",
      };
  }

  return {
    ...base,
    state:
      input.purchaseState === HarmonizedPurchaseState.ENTITLED ||
      input.purchaseState === HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT
        ? "Active"
        : "Unknown",
  };
}

export function mergeVerifiedSubscriptionSnapshot(
  existing: ExistingSubscriptionSnapshotFields | null,
  snapshot: VerifiedSubscriptionSnapshot,
): VerifiedSubscriptionSnapshot {
  if (!existing) return snapshot;

  return {
    ...snapshot,
    expiresAt: snapshot.expiresAt ?? existing.expiresAt,
    renewsAt:
      snapshot.willRenew === false
        ? undefined
        : (snapshot.renewsAt ?? existing.renewsAt),
    willRenew: snapshot.willRenew ?? existing.willRenew,
    cancellationReason:
      snapshot.cancellationReason !== undefined ||
      snapshot.clearCancellationReason
        ? snapshot.cancellationReason
        : existing.cancellationReason,
    currency: snapshot.currency ?? existing.currency,
    priceAmountMicros: snapshot.priceAmountMicros ?? existing.priceAmountMicros,
  };
}

// Receipt verification is the synchronous bootstrap path for
// subscriptions. Webhooks keep lifecycle state fresh later, but a
// successful verify must be enough for SDK clients to bind the just-
// purchased token to their app user.
export const recordVerifiedSubscription = internalMutation({
  args: {
    projectId: v.id("projects"),
    platform: subscriptionPlatformValidator,
    purchaseToken: v.string(),
    productId: v.string(),
    purchaseState: v.string(),
    subscriptionState: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    renewsAt: v.optional(v.number()),
    willRenew: v.optional(v.boolean()),
    currency: v.optional(v.string()),
    priceAmountMicros: v.optional(v.number()),
    revocationReasonIOS: v.optional(v.number()),
  },
  returns: v.union(v.id("subscriptions"), v.null()),
  handler: async (ctx, args) => recordVerifiedSubscriptionHandler(ctx, args),
});

export async function recordVerifiedSubscriptionHandler(
  ctx: MutationCtx,
  args: RecordVerifiedSubscriptionArgs,
): Promise<Id<"subscriptions"> | null> {
  await assertProjectWritable(ctx, args.projectId);
  const snapshot = buildVerifiedSubscriptionSnapshot({
    platform: args.platform,
    productId: args.productId,
    purchaseState: normalizeHarmonizedPurchaseState(args.purchaseState),
    subscriptionState: args.subscriptionState,
    expiresAt: args.expiresAt,
    renewsAt: args.renewsAt,
    willRenew: args.willRenew,
    currency: args.currency,
    priceAmountMicros: args.priceAmountMicros,
    revocationReasonIOS: args.revocationReasonIOS,
  });
  if (!snapshot) return null;

  const supersedingResolution = await findSupersedingSubscription(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  if (supersedingResolution.aliased) {
    return supersedingResolution.subscription?._id ?? null;
  }
  const existing = await findSubscriptionByToken(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  // Verification bootstraps a token before server notifications arrive. Once
  // a store event governs the row, a client can replay an older but still-valid
  // transaction; without comparable ordering metadata that snapshot must not
  // roll canonical product, state, or expiry backward.
  if (existing?.lastEventId) return existing._id;
  const now = Date.now();

  const next = mergeVerifiedSubscriptionSnapshot(existing, snapshot);
  return persistSubscriptionSnapshot(ctx, {
    projectId: args.projectId,
    platform: args.platform,
    purchaseToken: args.purchaseToken,
    existing,
    next,
    now,
  });
}

async function persistSubscriptionSnapshot(
  ctx: MutationCtx,
  args: PersistSubscriptionSnapshotArgs,
): Promise<Id<"subscriptions">> {
  // Stats deltas must compare the old row against the old catalog entry
  // and the new row against the new one; otherwise product/platform changes
  // subtract the wrong MRR bucket.
  const afterBillingPeriod = await fetchBillingPeriod(
    ctx,
    args.projectId,
    args.platform,
    args.next.productId,
  );
  const beforeBillingPeriod =
    args.existing &&
    (args.existing.productId !== args.next.productId ||
      args.existing.platform !== args.platform)
      ? await fetchBillingPeriod(
          ctx,
          args.projectId,
          args.existing.platform,
          args.existing.productId,
        )
      : afterBillingPeriod;
  const beforeContribution = args.existing
    ? statsContributionFor(args.existing, beforeBillingPeriod, args.now)
    : null;

  const row = {
    purchaseToken: args.purchaseToken,
    productKind: "subscription" as const,
    ...(args.existing?.userId ? { userId: args.existing.userId } : {}),
    productId: args.next.productId,
    platform: args.platform,
    state: args.next.state,
    expiresAt: args.next.expiresAt,
    renewsAt: args.next.renewsAt,
    willRenew: args.next.willRenew,
    cancellationReason: args.next.cancellationReason,
    currency: args.next.currency,
    priceAmountMicros: args.next.priceAmountMicros,
    updatedAt: args.now,
    ...(args.lastEvent
      ? {
          lastEventId: args.lastEvent._id,
          lastEventOccurredAt: args.lastEvent.occurredAt,
          lastEventCreationTime: args.lastEvent._creationTime,
          lastEventSourceNotificationId: args.lastEvent.sourceNotificationId,
          lastEventSource: {
            type: args.lastEvent.type,
            environment: args.lastEvent.environment,
            productId: args.lastEvent.productId,
            applicationId: args.lastEvent.applicationId,
            transactionId: args.lastEvent.transactionId,
            originalTransactionId: args.lastEvent.originalTransactionId,
            currency: args.lastEvent.currency,
            priceAmountMicros: args.lastEvent.priceAmountMicros,
          },
        }
      : {}),
  };

  const subscriptionId = args.existing
    ? args.existing._id
    : await ctx.db.insert("subscriptions", {
        projectId: args.projectId,
        startedAt: args.now,
        ...row,
      });

  if (args.existing) {
    await ctx.db.patch(args.existing._id, row);
  }

  const updatedRow = (await ctx.db.get(subscriptionId))!;
  const afterContribution = statsContributionFor(
    updatedRow,
    afterBillingPeriod,
    args.now,
  );
  await applyStatsTransition(
    ctx,
    args.projectId,
    beforeContribution,
    afterContribution,
  );

  return subscriptionId;
}

function findSubscriptionByToken(
  ctx: Pick<QueryCtx, "db">,
  projectId: Id<"projects">,
  purchaseToken: string,
): Promise<Doc<"subscriptions"> | null> {
  return ctx.db
    .query("subscriptions")
    .withIndex("by_project_and_token", (q) =>
      q.eq("projectId", projectId).eq("purchaseToken", purchaseToken),
    )
    .unique();
}

const MAX_SUBSCRIPTION_TOKEN_ALIAS_HOPS = 64;

type SupersedingSubscriptionResolution =
  | { aliased: false }
  | {
      aliased: true;
      subscription: Doc<"subscriptions"> | null;
      productId?: string;
    };

async function findSupersedingSubscription(
  ctx: Pick<QueryCtx, "db">,
  projectId: Id<"projects">,
  purchaseToken: string,
): Promise<SupersedingSubscriptionResolution> {
  let token = purchaseToken;
  let productId: string | undefined;
  const seen = new Set<string>([token]);
  for (let hop = 0; hop <= MAX_SUBSCRIPTION_TOKEN_ALIAS_HOPS; hop += 1) {
    const alias = await ctx.db
      .query("subscriptionTokenAliases")
      .withIndex("by_project_and_token", (q) =>
        q.eq("projectId", projectId).eq("purchaseToken", token),
      )
      .unique();
    if (!alias) {
      return hop === 0
        ? { aliased: false }
        : {
            aliased: true,
            subscription: await findSubscriptionByToken(ctx, projectId, token),
            productId,
          };
    }
    if (hop === 0) productId = alias.predecessorProductId;
    if (hop === MAX_SUBSCRIPTION_TOKEN_ALIAS_HOPS) {
      return { aliased: true, subscription: null, productId };
    }
    if (seen.has(alias.successorPurchaseToken)) {
      return { aliased: true, subscription: null, productId };
    }
    token = alias.successorPurchaseToken;
    seen.add(token);
  }
  return { aliased: true, subscription: null, productId };
}

async function recordSubscriptionTokenAlias(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    purchaseToken?: string;
    successorPurchaseToken: string;
    predecessorProductId?: string;
    now: number;
  },
): Promise<void> {
  if (
    !args.purchaseToken ||
    args.purchaseToken === args.successorPurchaseToken
  ) {
    return;
  }
  const existing = await ctx.db
    .query("subscriptionTokenAliases")
    .withIndex("by_project_and_token", (q) =>
      q
        .eq("projectId", args.projectId)
        .eq("purchaseToken", args.purchaseToken as string),
    )
    .unique();
  if (existing) {
    if (existing.successorPurchaseToken !== args.successorPurchaseToken) {
      await ctx.db.patch(existing._id, {
        successorPurchaseToken: args.successorPurchaseToken,
        predecessorProductId:
          existing.predecessorProductId ?? args.predecessorProductId,
        updatedAt: args.now,
      });
    }
    return;
  }
  await ctx.db.insert("subscriptionTokenAliases", {
    projectId: args.projectId,
    purchaseToken: args.purchaseToken,
    successorPurchaseToken: args.successorPurchaseToken,
    predecessorProductId: args.predecessorProductId,
    createdAt: args.now,
    updatedAt: args.now,
  });
}

function preferredReplacementSnapshot(
  current: Doc<"subscriptions"> | null,
  linked: Doc<"subscriptions"> | null,
): Doc<"subscriptions"> | null {
  if (!current) return linked;
  // Store timestamps from predecessor and replacement tokens are not a total
  // order: the predecessor can expire after the replacement becomes active.
  // Current-token state therefore wins even when it came from verification;
  // user identity and start history are merged separately during reconciliation.
  return current;
}

export const getSourceProductIdByToken = internalQuery({
  args: {
    projectId: v.id("projects"),
    purchaseToken: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => getSourceProductIdByTokenHandler(ctx, args),
});

export async function getSourceProductIdByTokenHandler(
  ctx: Pick<QueryCtx, "db">,
  args: { projectId: Id<"projects">; purchaseToken: string },
): Promise<string | null> {
  const resolution = await findSupersedingSubscription(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  if (resolution.aliased) return resolution.productId ?? null;
  const subscription = await findSubscriptionByToken(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  return subscription?.productId ?? null;
}

export const getCurrentProductIdByToken = internalQuery({
  args: {
    projectId: v.id("projects"),
    purchaseToken: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => getCurrentProductIdByTokenHandler(ctx, args),
});

export async function getCurrentProductIdByTokenHandler(
  ctx: Pick<QueryCtx, "db">,
  args: { projectId: Id<"projects">; purchaseToken: string },
): Promise<string | null> {
  const resolution = await findSupersedingSubscription(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  if (resolution.aliased) return resolution.subscription?.productId ?? null;
  const subscription = await findSubscriptionByToken(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  return subscription?.productId ?? null;
}

// Look up a product's billing period from the kit-side catalog. We
// Look up the row for the EXACT (platform, productId) — `products` is
// keyed by (projectId, platform, productId) precisely because the
// same SKU can exist on both stores with different billing periods.
// Earlier behaviour preferred iOS over Android by walking both
// platforms, which made an Android subscription inherit the iOS
// period when those rows diverged and skewed `mrrMicros` on both the
// incremental delta and the next recompute (PR #124
// (https://github.com/hyodotdev/openiap/pull/124) review). Returns
// undefined when the product isn't tracked or has no billingPeriod —
// monthlyMicrosForSub treats that as a P1M fallback.
async function fetchBillingPeriod(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  platform: SubscriptionPlatform,
  productId: string,
): Promise<string | undefined> {
  const product = await ctx.db
    .query("products")
    .withIndex("by_project_and_platform_and_product", (q) =>
      q
        .eq("projectId", projectId)
        .eq("platform", platform)
        .eq("productId", productId),
    )
    .unique();
  return product?.billingPeriod ?? undefined;
}

function coerceEventInput(raw: RawEventInput): SubscriptionEventInput {
  const appleRenewalPreference =
    raw.platform === "IOS" &&
    raw.type === "SubscriptionProductChanged" &&
    raw.effectiveImmediately !== true;
  return {
    type: raw.type,
    // Apple's renewal preference is the product for the next billing period;
    // the current transaction remains active until then. Keep the target on
    // the source event, but do not replace the canonical subscription early.
    productId: appleRenewalPreference ? undefined : raw.productId,
    subscriptionState: raw.subscriptionState,
    expiresAt: raw.expiresAt,
    renewsAt: raw.renewsAt,
    willRenew: raw.willRenew,
    cancellationReason: raw.cancellationReason,
    currency: appleRenewalPreference ? undefined : raw.currency,
    priceAmountMicros: appleRenewalPreference
      ? undefined
      : raw.priceAmountMicros,
  };
}

function isActive(
  sub: Doc<"subscriptions">,
  now: number = Date.now(),
): boolean {
  return entitlementActive(sub, now);
}

function normalizeHarmonizedPurchaseState(
  state: string,
): HarmonizedPurchaseState {
  const normalized = state.trim().toUpperCase().replace(/-/g, "_");
  if (normalized in HarmonizedPurchaseState) {
    return HarmonizedPurchaseState[
      normalized as keyof typeof HarmonizedPurchaseState
    ];
  }
  return HarmonizedPurchaseState.UNKNOWN;
}

// Bind a subscription to a userId. Called by the SDK after a successful
// receipt validation when the host app knows which user owns the receipt.
export const bindSubscriptionToUser = internalMutation({
  args: {
    projectId: v.id("projects"),
    purchaseToken: v.string(),
    userId: v.string(),
  },
  returns: v.union(v.id("subscriptions"), v.null()),
  handler: async (ctx, args) => bindSubscriptionToUserHandler(ctx, args),
});

/**
 * The retained source a re-emitted entitlement event is attributed to. The
 * stored row is preferred; a pruned one is reconstructed from the snapshot the
 * subscription keeps. Price is stripped: a webhook already reported it, and
 * repeating it would put the same money on another event.
 */
async function retainedSourceEventFor(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  sub: Doc<"subscriptions">,
) {
  if (!sub.lastEventId) return null;
  const retained = await ctx.db.get(sub.lastEventId);
  const source =
    retained?.projectId === projectId
      ? retained
      : sub.lastEventSource &&
          sub.lastEventOccurredAt !== undefined &&
          sub.lastEventSourceNotificationId
        ? {
            _id: sub.lastEventId,
            type: sub.lastEventSource.type,
            platform: sub.platform,
            environment: sub.lastEventSource.environment,
            productId: sub.lastEventSource.productId,
            applicationId: sub.lastEventSource.applicationId,
            transactionId: sub.lastEventSource.transactionId,
            originalTransactionId: sub.lastEventSource.originalTransactionId,
            sourceNotificationId: sub.lastEventSourceNotificationId,
            occurredAt: sub.lastEventOccurredAt,
          }
        : null;
  if (!source) return null;
  return {
    ...source,
    currency: undefined,
    priceAmountMicros: undefined,
    amountProvenance: undefined,
  };
}

/**
 * Moves an existing binding. `bindSubscriptionToUserHandler` refuses this on
 * purpose — a caller holding a purchase token has not proved it owns the
 * purchase — so correcting a wrong binding needs an operator-authorized path.
 * Callers must gate this on a secret key.
 */
export async function rebindSubscriptionToUserHandler(
  ctx: MutationCtx,
  args: BindSubscriptionToUserArgs,
): Promise<{ subscriptionId: Id<"subscriptions">; notified: boolean } | null> {
  if (!isValidSubscriptionUserId(args.userId)) {
    throw new ConvexError("userId must be nonblank and at most 256 characters");
  }
  await assertProjectWritable(ctx, args.projectId);
  // Resolve exactly as `bind` does. An operator correcting a wrong binding
  // usually has the token the customer reported, which on Play may be the one
  // a replacement superseded.
  const supersedingResolution = await findSupersedingSubscription(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  const sub = supersedingResolution.aliased
    ? supersedingResolution.subscription
    : await findSubscriptionByToken(ctx, args.projectId, args.purchaseToken);
  if (!sub) return null;
  if (sub.userId === args.userId) {
    return { subscriptionId: sub._id, notified: true };
  }
  const previousUserId = sub.userId;
  const now = Date.now();

  // A consumer that gates access on commerce events has no other way to learn
  // the purchase moved: without these it keeps the wrong user entitled and
  // never entitles the real one. Decide before writing, so the caller is never
  // told a rebind succeeded when the notification half of it could not.
  const entitled = isActive({ ...sub, userId: args.userId }, now);
  const sourceEvent = entitled
    ? await retainedSourceEventFor(ctx, args.projectId, sub)
    : null;
  await ctx.db.patch(sub._id, { userId: args.userId, updatedAt: now });
  if (!entitled) return { subscriptionId: sub._id, notified: true };
  if (!sourceEvent) {
    // Every retained trace of the originating notification is gone, so no
    // event can be attributed. The binding moved; the operator must reconcile
    // the developer backend by hand.
    console.warn(
      "[subscriptions/rebind] moved a binding without emitting entitlement events",
      { projectId: args.projectId, subscriptionId: sub._id },
    );
    return { subscriptionId: sub._id, notified: false };
  }
  const snapshot = {
    state: sub.state,
    productId: sub.productId,
    ...(sub.expiresAt !== undefined ? { expiresAt: sub.expiresAt } : {}),
    ...(sub.renewsAt !== undefined ? { renewsAt: sub.renewsAt } : {}),
    ...(sub.willRenew !== undefined ? { willRenew: sub.willRenew } : {}),
    ...(sub.cancellationReason
      ? { cancellationReason: sub.cancellationReason }
      : {}),
  };
  for (const [userId, active, previouslyActive] of [
    ...(previousUserId
      ? ([[previousUserId, false, true]] as const)
      : ([] as const)),
    [args.userId, true, false] as const,
  ]) {
    await emitCommerceEvent(ctx, {
      projectId: args.projectId,
      transition: null,
      active,
      previouslyActive,
      sourceEvent,
      subscriptionId: sub._id,
      subscription: { ...snapshot, userId },
    });
  }
  return { subscriptionId: sub._id, notified: true };
}

export async function bindSubscriptionToUserHandler(
  ctx: MutationCtx,
  args: BindSubscriptionToUserArgs,
): Promise<Id<"subscriptions"> | null> {
  if (!isValidSubscriptionUserId(args.userId)) {
    throw new ConvexError("userId must be nonblank and at most 256 characters");
  }
  await assertProjectWritable(ctx, args.projectId);
  const supersedingResolution = await findSupersedingSubscription(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  const sub = supersedingResolution.aliased
    ? supersedingResolution.subscription
    : await findSubscriptionByToken(ctx, args.projectId, args.purchaseToken);
  if (!sub) return null;
  if (sub.userId === args.userId) return sub._id;
  if (sub.userId) {
    // Reported the same as an unknown token. A distinct error would tell any
    // holder of the app-embedded publishable key whether a token exists and
    // whether someone owns it. The operator still sees the collision.
    console.warn(
      "[subscriptions/bind] rejected a bind for an already-bound subscription",
      { projectId: args.projectId, subscriptionId: sub._id },
    );
    return null;
  }
  const now = Date.now();
  await ctx.db.patch(sub._id, {
    userId: args.userId,
    updatedAt: now,
  });

  // If the store webhook won the race against verify/bind, its initial event
  // had no account identity. Emit one correlated entitlement grant after the
  // binding so a developer backend never has to recover a purchase token from
  // the public payload. The normal verify -> bind -> webhook path has no
  // lastEventId yet and emits its grant when that first webhook arrives.
  if (sub.lastEventId && isActive(sub, now)) {
    const retainedSource = await ctx.db.get(sub.lastEventId);
    const sourceEvent =
      retainedSource?.projectId === args.projectId
        ? retainedSource
        : sub.lastEventSource &&
            sub.lastEventOccurredAt !== undefined &&
            sub.lastEventSourceNotificationId
          ? {
              _id: sub.lastEventId,
              type: sub.lastEventSource.type,
              platform: sub.platform,
              environment: sub.lastEventSource.environment,
              productId: sub.lastEventSource.productId,
              applicationId: sub.lastEventSource.applicationId,
              transactionId: sub.lastEventSource.transactionId,
              originalTransactionId: sub.lastEventSource.originalTransactionId,
              currency: sub.lastEventSource.currency,
              priceAmountMicros: sub.lastEventSource.priceAmountMicros,
              sourceNotificationId: sub.lastEventSourceNotificationId,
              occurredAt: sub.lastEventOccurredAt,
            }
          : null;
    if (sourceEvent) {
      // This only fires after a webhook already emitted the notification's
      // amount, so repeating it would put the same money on a second event.
      const entitlementSource = {
        ...sourceEvent,
        currency: undefined,
        priceAmountMicros: undefined,
        amountProvenance: undefined,
      };
      await emitCommerceEvent(ctx, {
        projectId: args.projectId,
        transition: null,
        active: true,
        previouslyActive: false,
        sourceEvent: entitlementSource,
        subscriptionId: sub._id,
        subscription: {
          state: sub.state,
          productId: sub.productId,
          ...(sub.expiresAt !== undefined ? { expiresAt: sub.expiresAt } : {}),
          ...(sub.renewsAt !== undefined ? { renewsAt: sub.renewsAt } : {}),
          ...(sub.willRenew !== undefined ? { willRenew: sub.willRenew } : {}),
          ...(sub.cancellationReason
            ? { cancellationReason: sub.cancellationReason }
            : {}),
          userId: args.userId,
        },
      });
    }
  }
  return sub._id;
}

export async function drainSubscriptionUserErasurePage(
  ctx: MutationCtx,
  jobId: Id<"subscriptionUserErasureJobs">,
): Promise<{
  done: boolean;
  subscriptionsErased: number;
  commerceEventsErased: number;
}> {
  const job = await ctx.db.get(jobId);
  if (!job || job.status === "completed" || !job.userId) {
    return {
      done: true,
      subscriptionsErased: job?.subscriptionsErased ?? 0,
      commerceEventsErased: job?.commerceEventsErased ?? 0,
    };
  }

  const now = Date.now();
  await ctx.db.patch(jobId, { status: "running", updatedAt: now });
  const [subscriptions, commerceEvents] = await Promise.all([
    ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", job.projectId).eq("userId", job.userId),
      )
      .take(USER_ERASURE_BATCH_SIZE),
    ctx.db
      .query("commerceEvents")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", job.projectId).eq("userId", job.userId),
      )
      .take(USER_ERASURE_BATCH_SIZE),
  ]);

  for (const subscription of subscriptions) {
    await ctx.db.patch(subscription._id, { userId: undefined });
  }
  let commerceEventsErasedThisPage = 0;
  let waitingForClaimedDelivery = false;
  for (const event of commerceEvents) {
    const deliveries = await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .collect();
    if (deliveries.some((delivery) => delivery.status === "delivering")) {
      waitingForClaimedDelivery = true;
      continue;
    }
    if (event.eventType.startsWith("entitlement.")) {
      for (const delivery of deliveries) await ctx.db.delete(delivery._id);
      await ctx.db.delete(event._id);
    } else {
      await ctx.db.patch(event._id, { userId: undefined });
    }
    commerceEventsErasedThisPage += 1;
  }

  const subscriptionsErased = job.subscriptionsErased + subscriptions.length;
  const commerceEventsErased =
    job.commerceEventsErased + commerceEventsErasedThisPage;
  const done =
    !waitingForClaimedDelivery &&
    subscriptions.length < USER_ERASURE_BATCH_SIZE &&
    commerceEvents.length < USER_ERASURE_BATCH_SIZE;

  if (done) {
    await ctx.db.patch(jobId, {
      userId: undefined,
      status: "completed",
      subscriptionsErased,
      commerceEventsErased,
      updatedAt: now,
      completedAt: now,
    });
  } else {
    await ctx.db.patch(jobId, {
      subscriptionsErased,
      commerceEventsErased,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      waitingForClaimedDelivery ? 1_000 : 0,
      internal.subscriptions.internal.drainSubscriptionUserErasureJob,
      { jobId },
    );
  }

  return { done, subscriptionsErased, commerceEventsErased };
}

export const drainSubscriptionUserErasureJob = internalMutation({
  args: { jobId: v.id("subscriptionUserErasureJobs") },
  handler: async (ctx, args) =>
    drainSubscriptionUserErasurePage(ctx, args.jobId),
});

export const resumeSubscriptionUserErasureJobs = internalMutation({
  args: {},
  returns: v.object({ scheduled: v.number() }),
  handler: async (ctx) => {
    const staleBefore = Date.now() - USER_ERASURE_STALE_MS;
    const [queued, stale] = await Promise.all([
      ctx.db
        .query("subscriptionUserErasureJobs")
        .withIndex("by_status_and_updated", (q) => q.eq("status", "queued"))
        .take(10),
      ctx.db
        .query("subscriptionUserErasureJobs")
        .withIndex("by_status_and_updated", (q) =>
          q.eq("status", "running").lt("updatedAt", staleBefore),
        )
        .take(10),
    ]);
    const jobs = [...queued, ...stale].slice(0, 10);
    for (const job of jobs) {
      await ctx.scheduler.runAfter(
        0,
        internal.subscriptions.internal.drainSubscriptionUserErasureJob,
        { jobId: job._id },
      );
    }
    return { scheduled: jobs.length };
  },
});

export async function pruneCompletedSubscriptionUserErasureJobsHandler(
  ctx: MutationCtx,
): Promise<{ pruned: number }> {
  const completedBefore = Date.now() - USER_ERASURE_JOB_RETENTION_MS;
  const completed = await ctx.db
    .query("subscriptionUserErasureJobs")
    .withIndex("by_status_and_updated", (q) =>
      q.eq("status", "completed").lt("updatedAt", completedBefore),
    )
    .take(USER_ERASURE_PRUNER_BATCH_SIZE);

  for (const job of completed) {
    await ctx.db.delete(job._id);
  }
  if (completed.length === USER_ERASURE_PRUNER_BATCH_SIZE) {
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.internal.pruneCompletedSubscriptionUserErasureJobs,
      {},
    );
  }
  return { pruned: completed.length };
}

export const pruneCompletedSubscriptionUserErasureJobs = internalMutation({
  args: {},
  returns: v.object({ pruned: v.number() }),
  handler: async (ctx) => pruneCompletedSubscriptionUserErasureJobsHandler(ctx),
});
