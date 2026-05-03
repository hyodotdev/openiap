import { internalMutation, type MutationCtx } from "../_generated/server";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";

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

const eventInputValidator = v.object({
  type: v.string(),
  productId: v.optional(v.string()),
  subscriptionState: v.optional(subscriptionStateValidator),
  expiresAt: v.optional(v.number()),
  renewsAt: v.optional(v.number()),
  cancellationReason: v.optional(v.string()),
  currency: v.optional(v.string()),
  priceAmountMicros: v.optional(v.number()),
  platform: v.union(v.literal("IOS"), v.literal("Android")),
  purchaseToken: v.string(),
});

type RawEventInput = Infer<typeof eventInputValidator>;

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
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_token", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("purchaseToken", args.event.purchaseToken),
      )
      .unique();

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

    const now = Date.now();
    const next = transition.next;

    // Pull billing period for MRR calculation. Skipped if state isn't
    // counted (Active / InGracePeriod / InBillingRetry) since
    // statsContributionFor returns null in that case anyway. The
    // AFTER side always uses the new product's period.
    const billingPeriod = await fetchBillingPeriod(
      ctx,
      args.projectId,
      next.productId,
    );

    // BEFORE side has to use the OLD product's billing period — when
    // an upgrade or downgrade event flips `productId`, using the new
    // product's period to compute the BEFORE delta would subtract
    // the wrong monthly-normalized amount from MRR and corrupt the
    // incremental counter (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    // Reuse `billingPeriod` only when the productId didn't change.
    const beforeBillingPeriod =
      existing && existing.productId !== next.productId
        ? await fetchBillingPeriod(ctx, args.projectId, existing.productId)
        : billingPeriod;

    // Capture the BEFORE contribution against the still-existing row
    // so the stats delta below subtracts what the row used to count
    // for, then adds what it counts for after the patch.
    const beforeContribution = existing
      ? statsContributionFor(existing, beforeBillingPeriod, now)
      : null;

    let subscriptionId: Id<"subscriptions">;
    let updatedRow: Doc<"subscriptions">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        productId: next.productId,
        state: next.state,
        expiresAt: next.expiresAt,
        renewsAt: next.renewsAt,
        willRenew: next.willRenew,
        cancellationReason: next.cancellationReason,
        currency: next.currency,
        priceAmountMicros: next.priceAmountMicros,
        updatedAt: now,
        lastEventId: args.eventId,
      });
      subscriptionId = existing._id;
      updatedRow = (await ctx.db.get(existing._id))!;
    } else {
      subscriptionId = await ctx.db.insert("subscriptions", {
        projectId: args.projectId,
        purchaseToken: args.event.purchaseToken,
        productId: next.productId,
        platform: args.event.platform,
        state: next.state,
        expiresAt: next.expiresAt,
        renewsAt: next.renewsAt,
        willRenew: next.willRenew,
        cancellationReason: next.cancellationReason,
        currency: next.currency,
        priceAmountMicros: next.priceAmountMicros,
        startedAt: now,
        updatedAt: now,
        lastEventId: args.eventId,
      });
      updatedRow = (await ctx.db.get(subscriptionId))!;
    }

    const afterContribution = statsContributionFor(
      updatedRow,
      billingPeriod,
      now,
    );
    await applyStatsTransition(
      ctx,
      args.projectId,
      beforeContribution,
      afterContribution,
    );

    return {
      transition: transition.transition ?? null,
      active: transition.active,
      subscriptionId,
    };
  },
});

// Look up a product's billing period from the kit-side catalog. We
// prefer iOS over Android when both platforms ship the same productId
// (matches what `metricsSummary` does for its read-path scan). Returns
// undefined when the product isn't tracked or has no billingPeriod —
// monthlyMicrosForSub treats that as a P1M fallback.
async function fetchBillingPeriod(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  productId: string,
): Promise<string | undefined> {
  for (const platform of ["IOS", "Android"] as const) {
    const product = await ctx.db
      .query("products")
      .withIndex("by_project_and_platform_and_product", (q) =>
        q
          .eq("projectId", projectId)
          .eq("platform", platform)
          .eq("productId", productId),
      )
      .unique();
    if (product?.billingPeriod !== undefined) return product.billingPeriod;
  }
  return undefined;
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

// Bind a subscription to a userId. Called by the SDK after a successful
// receipt validation when the host app knows which user owns the receipt.
export const bindSubscriptionToUser = internalMutation({
  args: {
    projectId: v.id("projects"),
    purchaseToken: v.string(),
    userId: v.string(),
  },
  returns: v.union(v.id("subscriptions"), v.null()),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_project_and_token", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("purchaseToken", args.purchaseToken),
      )
      .unique();
    if (!sub) return null;
    if (sub.userId === args.userId) return sub._id;
    await ctx.db.patch(sub._id, {
      userId: args.userId,
      updatedAt: Date.now(),
    });
    return sub._id;
  },
});
