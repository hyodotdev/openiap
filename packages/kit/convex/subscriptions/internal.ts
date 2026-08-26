import { internalMutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import {
  applySubscriptionTransition,
  type CurrentSubscription,
  type SubscriptionEventInput,
} from "./stateMachine";
import { applyStatsTransition, statsContributionFor } from "./stats";
import { assertProjectWritable } from "../projects/writable";

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
  | "cancellationReason"
  | "currency"
  | "priceAmountMicros"
  | "platform"
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
  currency?: string;
  priceAmountMicros?: number;
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
  currency?: string;
  priceAmountMicros?: number;
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
  lastEventId?: Id<"webhookEvents">;
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
  if (!storedEvent.purchaseToken) {
    if (storedEvent.appliedAt === undefined) {
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
    }
    return { transition: null, active: false };
  }

  const existing = await findSubscriptionByToken(
    ctx,
    args.projectId,
    storedEvent.purchaseToken,
  );
  // Captured before any transition so entitlement deltas are emitted from the
  // pre-event gate, not the post-event one.
  const previouslyActive = existing ? isActive(existing) : false;
  const noOpResult = (): ApplySubscriptionEventResult => ({
    transition: null,
    active: existing ? isActive(existing) : false,
    ...(existing ? { subscriptionId: existing._id } : {}),
  });

  if (storedEvent.appliedAt !== undefined) return noOpResult();

  // Rollout compatibility for events written before appliedAt existed. The
  // current last event proves itself applied; an event older than the current
  // last event must be marked handled without being allowed to roll state
  // backwards. Store timestamps are only millisecond-precision, so ingestion
  // order breaks ties between distinct same-timestamp events. A recorded-but-
  // unapplied newest event still falls through and repairs the original
  // action/mutation gap.
  if (existing?.lastEventId) {
    if (existing.lastEventId === args.eventId) {
      await ctx.db.patch(storedEvent._id, { appliedAt: now });
      return noOpResult();
    }
    const lastEvent = await ctx.db.get(existing.lastEventId);
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
    cancellationReason: storedEvent.cancellationReason,
    currency: storedEvent.currency,
    priceAmountMicros: storedEvent.priceAmountMicros,
    platform: storedEvent.platform,
    purchaseToken: storedEvent.purchaseToken,
  };
  const transition = applySubscriptionTransition(
    current,
    coerceEventInput(event),
  );

  if (!transition.next) {
    await ctx.db.patch(storedEvent._id, { appliedAt: now });
    await emitCommerceEvent(ctx, {
      projectId: args.projectId,
      transition: transition.transition ?? null,
      active: false,
      previouslyActive,
      sourceEvent: storedEvent,
      ...(existing ? { subscriptionId: existing._id } : {}),
      ...(existing
        ? {
            subscription: {
              productId: existing.productId,
              ...(existing.userId ? { userId: existing.userId } : {}),
            },
          }
        : {}),
    });
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
    lastEventId: args.eventId,
  });
  await ctx.db.patch(storedEvent._id, { appliedAt: now });
  await emitCommerceEvent(ctx, {
    projectId: args.projectId,
    transition: transition.transition ?? null,
    active: transition.active,
    previouslyActive,
    sourceEvent: storedEvent,
    subscriptionId,
    subscription: {
      productId: transition.next.productId,
      ...(existing?.userId ? { userId: existing.userId } : {}),
    },
  });

  return {
    transition: transition.transition ?? null,
    active: transition.active,
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
    "productId" | "expiresAt" | "renewsAt" | "currency" | "priceAmountMicros"
  > = {
    productId: input.productId,
    expiresAt: input.expiresAt,
    renewsAt: input.renewsAt,
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
          cancellationReason: "Refunded",
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
        willRenew: true,
        cancellationReason: undefined,
        clearCancellationReason: true,
      };
    case "SUBSCRIPTION_STATE_CANCELED":
      return {
        ...base,
        state: "Active",
        willRenew: false,
        cancellationReason: "UserCanceled",
      };
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return {
        ...base,
        state: "InGracePeriod",
        willRenew: true,
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
    renewsAt: snapshot.renewsAt ?? existing.renewsAt,
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
    currency: v.optional(v.string()),
    priceAmountMicros: v.optional(v.number()),
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
    currency: args.currency,
    priceAmountMicros: args.priceAmountMicros,
  });
  if (!snapshot) return null;

  const existing = await findSubscriptionByToken(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
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
    ...(args.lastEventId !== undefined
      ? { lastEventId: args.lastEventId }
      : {}),
  };

  const subscriptionId = args.existing
    ? args.existing._id
    : await ctx.db.insert("subscriptions", {
        projectId: args.projectId,
        purchaseToken: args.purchaseToken,
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
  ctx: MutationCtx,
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
  return {
    type: raw.type,
    productId: raw.productId,
    subscriptionState: raw.subscriptionState,
    expiresAt: raw.expiresAt,
    renewsAt: raw.renewsAt,
    cancellationReason: raw.cancellationReason,
    currency: raw.currency,
    priceAmountMicros: raw.priceAmountMicros,
  };
}

function isActive(
  sub: Doc<"subscriptions">,
  now: number = Date.now(),
): boolean {
  const entitled = sub.state === "Active" || sub.state === "InGracePeriod";
  if (!entitled) return false;
  if (sub.expiresAt != null && sub.expiresAt <= now) return false;
  return true;
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

export async function bindSubscriptionToUserHandler(
  ctx: MutationCtx,
  args: BindSubscriptionToUserArgs,
): Promise<Id<"subscriptions"> | null> {
  await assertProjectWritable(ctx, args.projectId);
  const sub = await findSubscriptionByToken(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  if (!sub) return null;
  if (sub.userId === args.userId) return sub._id;
  await ctx.db.patch(sub._id, {
    userId: args.userId,
    updatedAt: Date.now(),
  });
  return sub._id;
}
