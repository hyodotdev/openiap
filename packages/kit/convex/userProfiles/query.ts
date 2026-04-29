import { query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { SPONSOR_CTA_THRESHOLD } from "../plans";

// Get current user's profile
export const getCurrentUserProfile = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      return null;
    }

    // Get user data from auth table
    const user = await ctx.db.get(userId);

    return {
      ...profile,
      email: user?.email,
    };
  },
});

// Check if user has profile
export const hasUserProfile = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return !!profile;
  },
});

// Get user stats
export const getUserStats = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      return null;
    }

    // Get user's organizations
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get current organization stats if available. `monthlyRequestLimit`
    // is a display-only sponsor CTA threshold; the verification path
    // itself has no monthly cap.
    let organizationStats = {
      monthlyRequestCount: 0,
      monthlyRequestLimit: SPONSOR_CTA_THRESHOLD,
      subscriptionTier: "developer" as "developer" | "pro" | "enterprise",
    };

    if (profile.currentOrganizationId) {
      const currentOrg = await ctx.db.get(profile.currentOrganizationId);
      if (currentOrg) {
        organizationStats = {
          monthlyRequestCount: currentOrg.monthlyRequestCount || 0,
          // Show at least the sponsor CTA threshold so legacy orgs
          // with stale low values (e.g. the 250 default from the
          // paid-plan era) don't display a misleadingly-low cap.
          // Sponsor-bumped orgs with an explicit higher value still
          // show their bumped number.
          monthlyRequestLimit: Math.max(
            currentOrg.monthlyRequestLimit ?? 0,
            SPONSOR_CTA_THRESHOLD,
          ),
          subscriptionTier: currentOrg.subscriptionTier || "developer",
        };

        // Get project count for current organization
        const projects = await ctx.db
          .query("projects")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", profile.currentOrganizationId!),
          )
          .collect();

        const recentValidationCount = 0;

        return {
          organizationCount: memberships.length,
          projectCount: projects.length,
          recentValidationCount,
          ...organizationStats,
        };
      }
    }

    return {
      organizationCount: memberships.length,
      projectCount: 0,
      recentValidationCount: 0,
      ...organizationStats,
    };
  },
});
