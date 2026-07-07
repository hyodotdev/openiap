import { internalMutation, type MutationCtx } from "../_generated/server";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import {
  applySubscriptionTransition,
  type CurrentSubscription,
  type SubscriptionEventInput,
} from "./stateMachine";
import { applyStatsTransition, statsContributionFor } from "./stats";

const subscriptionStateValidator = v.union(
  v.literal("Active"),
  v.literal("InGracePeriod"),
  v.literal("InBillingRetry"),
  v.literal("Expired"),
  v.literal("Revoked"),
  v.literal("Refunded"),
  v.literal("Paused"),
  v.literal("Unknown"),
);

const subscriptionPlatformValidator = v.union(
  v.literal("IOS"),
  v.literal("Android"),
);

const eventInputValidator = v.object({
  type: v.string(),
  productId: v.optional(v.string()),
  subscriptionState: v.optional(subscriptionStateValidator),
  expiresAt: v.optional(v.number()),
  renewsAt: v.optional(v.number()),
  cancellationReason: v.optional(v.string()),
  currency: v.optional(v.string()),
  priceAmountMicros: v.optional(v.number()),
  platform: subscriptionPlatformValidator,
  purchaseToken: v.string(),
});

type RawEventInput = Infer<typeof eventInputValidator>;
type SubscriptionState = Infer<typeof subscriptionStateValidator>;
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

// Apply a webhook event to the canonical `subscriptions` table. Idempotent
// with respect to `lastEventId` so a re-run of the same event (after a
// retry / replay) doesn't double-count metrics.
export const applySubscriptionEvent = internalMutation({
  args: {
    projectId: v.id("projects"),
    eventId: v.id("webhookEvents"),
    event: eventInputValidator,
  },
  returns: v.object({
    transition: v.union(v.string(), v.null()),
    active: v.boolean(),
    subscriptionId: v.optional(v.id("subscriptions")),
  }),
  handler: async (ctx, args) => {
    const existing = await findSubscriptionByToken(
      ctx,
      args.projectId,
      args.event.purchaseToken,
    );

    if (existing && existing.lastEventId === args.eventId) {
      return {
        transition: null,
        active: isActive(existing),
        subscriptionId: existing._id,
      };
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

    const transition = applySubscriptionTransition(
      current,
      coerceEventInput(args.event),
    );

    if (!transition.next) {
      return {
        transition: transition.transition ?? null,
        active: false,
        subscriptionId: existing?._id,
      };
    }

    const subscriptionId = await persistSubscriptionSnapshot(ctx, {
      projectId: args.projectId,
      platform: args.event.platform,
      purchaseToken: args.event.purchaseToken,
      existing,
      next: transition.next,
      now: Date.now(),
      lastEventId: args.eventId,
    });

    return {
      transition: transition.transition ?? null,
      active: transition.active,
      subscriptionId,
    };
  },
});

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
    type: raw.type as SubscriptionEventInput["type"],
    productId: raw.productId,
    subscriptionState: raw.subscriptionState,
    expiresAt: raw.expiresAt,
    renewsAt: raw.renewsAt,
    cancellationReason: raw.cancellationReason as
      | SubscriptionEventInput["cancellationReason"]
      | undefined,
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
