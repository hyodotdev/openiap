import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import type { SubscriptionPlanId } from "../plans";
import { subscriptionPlanValidator } from "../plans";

// Internal mutation to increment organization's monthly request count
export const incrementRequestCount = internalMutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);

    if (!organization) {
      throw new Error("Organization not found");
    }

    const currentCount = organization.monthlyRequestCount || 0;
    await ctx.db.patch(args.organizationId, {
      monthlyRequestCount: currentCount + 1,
      updatedAt: Date.now(),
    });

    return currentCount + 1;
  },
});

// Internal mutation to reset monthly request counts (for cron job)
export const resetMonthlyRequestCounts = internalMutation({
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();

    const updates = organizations.map((org) =>
      ctx.db.patch(org._id, {
        monthlyRequestCount: 0,
        updatedAt: Date.now(),
      }),
    );

    await Promise.all(updates);
    return organizations.length;
  },
});

/**
 * Increment the org's monthly request counter. IAPKit is free for
 * everyone with no monthly cap — abuse is handled at the edge
 * (shape / replay / burst guards in `server/api/v1/`), not here. This
 * mutation exists so the dashboard / telemetry can show usage; the
 * returned `allowed` is always true.
 */
export const assertUsageAllowedAndIncrement = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    allowed: v.boolean(),
    monthlyRequestCount: v.number(),
    subscriptionTier: subscriptionPlanValidator,
  }),
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const tier: SubscriptionPlanId = org.subscriptionTier ?? "developer";
    const current = org.monthlyRequestCount ?? 0;
    const next = current + 1;

    await ctx.db.patch(args.organizationId, {
      monthlyRequestCount: next,
      updatedAt: Date.now(),
    });

    return {
      allowed: true,
      monthlyRequestCount: next,
      subscriptionTier: tier,
    };
  },
});

export const recordVerificationUsage = internalMutation({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    monthlyRequestCount: v.number(),
    subscriptionTier: subscriptionPlanValidator,
  }),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    return await recordVerificationUsageForOrganization(ctx, organization);
  },
});

export const organizationExists = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    return Boolean(organization);
  },
});

export async function recordVerificationUsageForOrganization(
  ctx: MutationCtx,
  organization: Doc<"organizations">,
) {
  const tier: SubscriptionPlanId = organization.subscriptionTier ?? "developer";
  const current = organization.monthlyRequestCount ?? 0;
  const next = current + 1;
  const now = Date.now();

  await ctx.db.patch(organization._id, {
    monthlyRequestCount: next,
    updatedAt: now,
  });

  return {
    monthlyRequestCount: next,
    subscriptionTier: tier,
  };
}
