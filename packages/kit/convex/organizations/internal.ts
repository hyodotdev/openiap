import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import { v } from "convex/values";

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

export const organizationExists = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    return Boolean(organization);
  },
});

// Membership role for actions that gate on it; keeps the org schema internal.
export const getMembership = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.null(),
    v.object({
      role: v.union(
        v.literal("owner"),
        v.literal("admin"),
        v.literal("member"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .first();
    if (!membership) return null;
    return { role: membership.role };
  },
});

// Counts the request for the dashboard; IAPKit has no monthly cap.
export async function recordVerificationUsageForOrganization(
  ctx: MutationCtx,
  organization: Doc<"organizations">,
) {
  await ctx.db.patch(organization._id, {
    monthlyRequestCount: (organization.monthlyRequestCount ?? 0) + 1,
    updatedAt: Date.now(),
  });
}

export const pruneExpiredInvitations = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const rows = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_expiry", (q) => q.lte("expiresAt", Date.now()))
      .take(100);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 100)
      await ctx.scheduler.runAfter(
        0,
        internal.organizations.internal.pruneExpiredInvitations,
        {},
      );
    return rows.length;
  },
});
