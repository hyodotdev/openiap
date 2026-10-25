import { assertCliScope } from "../cli/scope";
import { query } from "../_generated/server";
import { createError, ErrorCode } from "../utils/errors";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getUserOrganizations = query({
  handler: async (ctx) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get all organizations the user is a member of
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get organization details for each membership
    const organizations = await Promise.all(
      memberships.map(async (membership) => {
        const org = await ctx.db.get(membership.organizationId);
        if (!org) return null;

        return {
          ...org,
          role: membership.role,
          joinedAt: membership.joinedAt,
        };
      }),
    );

    return organizations.filter(Boolean);
  },
});

export const getCurrentOrganization = query({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Get user profile to check current organization
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const orgId = args.organizationId || profile?.currentOrganizationId;
    if (!orgId) {
      return null;
    }

    // Check if user has access to this organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", orgId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      return null;
    }

    const organization = await ctx.db.get(orgId);
    if (!organization) {
      return null;
    }

    return {
      ...organization,
      role: membership.role,
    };
  },
});

export const getOrganizationBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!organization) {
      return null;
    }

    // Check if user is a member
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", organization._id).eq("userId", userId),
      )
      .first();

    if (!membership) {
      return null;
    }

    return {
      ...organization,
      role: membership.role,
    };
  },
});

export const hasOrganizations = query({
  handler: async (ctx) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return membership !== null;
  },
});

export const getOrganizationMembers = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Check if user has access to this organization
    const userMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (!userMembership) {
      return [];
    }

    // Get all members
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    // Get user details for each member
    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", membership.userId))
          .first();

        if (!user) return null;

        return {
          userId: membership.userId,
          email: user.email,
          name: user.name || profile?.displayName || "Unknown",
          role: membership.role,
          joinedAt: membership.joinedAt,
        };
      }),
    );

    return members.filter(Boolean);
  },
});

// Alias for compatibility
export const listOrganizationMembers = getOrganizationMembers;

export const getMyInvitations = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_user_and_expiry", (q) =>
        q.eq("userId", userId).gt("expiresAt", Date.now()),
      )
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (invitation) => {
        const organization = await ctx.db.get(invitation.organizationId);
        if (!organization || organization.pendingDeletion) return null;
        return {
          _id: invitation._id,
          organizationName: organization.name,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        };
      }),
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});

export const getPendingInvitations = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw createError(ErrorCode.NOT_AUTHENTICATED);
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();
    if (!membership || !["owner", "admin"].includes(membership.role))
      throw createError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    const result = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page
        .filter((invitation) => invitation.expiresAt > Date.now())
        .map(async (invitation) => {
          const user = await ctx.db.get(invitation.userId);
          return {
            _id: invitation._id,
            email: user?.email ?? "Invited account",
            role: invitation.role,
          };
        }),
    );
    return { ...result, page };
  },
});
