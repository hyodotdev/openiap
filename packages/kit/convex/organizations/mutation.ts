import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { SPONSOR_CTA_THRESHOLD } from "../plans";
import { createError, ErrorCode } from "../utils/errors";

// Helper to generate URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

export const createOrganization = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED);
    }

    const user = await ctx.db.get(userId);

    // Generate slug if not provided, or validate user-provided slug
    let slug = args.slug || generateSlug(args.name);

    // Validate slug format if user-provided
    if (args.slug) {
      // Ensure slug only contains lowercase letters, numbers, and hyphens
      slug = args.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (!slug) {
        slug = generateSlug(args.name);
      }
    }

    // Ensure slug is unique: check the base slug once; if taken, append a
    // random suffix so we don't do a 'query-in-a-loop' probe of `slug-1`,
    // `slug-2`, ... under contention.
    const existingBase = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    let finalSlug = slug;
    if (existingBase) {
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      finalSlug = `${slug}-${randomSuffix}`;
    }

    const now = Date.now();

    // Create organization
    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: finalSlug,
      billingEmail: user?.email ?? undefined,
      monthlyRequestCount: 0,
      // Display-only threshold that powers the dashboard's sponsor
      // CTA; the verification path does not enforce this value.
      monthlyRequestLimit: SPONSOR_CTA_THRESHOLD,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as owner
    await ctx.db.insert("organizationMembers", {
      organizationId,
      userId,
      role: "owner",
      joinedAt: now,
      updatedAt: now,
    });

    // Update user's current organization
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        currentOrganizationId: organizationId,
        updatedAt: now,
      });
    }

    return { organizationId, slug: finalSlug };
  },
});

export const updateOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    taxId: v.optional(v.union(v.string(), v.null())),
    // See https://stripe.com/docs/api/customer_tax_ids/object — e.g.
    // "eu_vat", "us_ein", "gb_vat". Kept as a string so we don't have
    // to hand-roll a validator for every Stripe-supported type.
    taxIdType: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED);
    }

    // Check if user is owner or admin
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw createError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.billingEmail !== undefined)
      updates.billingEmail = args.billingEmail;
    if (args.taxId !== undefined) {
      const normalized =
        typeof args.taxId === "string" ? args.taxId.trim() || null : null;
      updates.taxId = normalized;
    }
    if (args.taxIdType !== undefined) {
      const normalized =
        typeof args.taxIdType === "string"
          ? args.taxIdType.trim() || null
          : null;
      updates.taxIdType = normalized;
    }

    await ctx.db.patch(args.organizationId, updates);
  },
});

export const inviteMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED);
    }

    // Check if user is owner or admin
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      throw createError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Find user by email
    const users = await ctx.db.query("users").collect();
    const invitedUser = users.find((u) => u.email === args.email);

    if (!invitedUser) {
      throw createError(ErrorCode.USER_NOT_REGISTERED);
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("userId", invitedUser._id),
      )
      .first();

    if (existingMembership) {
      throw createError(ErrorCode.USER_ALREADY_MEMBER);
    }

    const now = Date.now();

    // Add member
    await ctx.db.insert("organizationMembers", {
      organizationId: args.organizationId,
      userId: invitedUser._id,
      role: args.role,
      joinedAt: now,
      updatedAt: now,
    });
  },
});

export const removeMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED);
    }

    // Check if current user is owner or admin
    const currentUserMembership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", currentUserId),
      )
      .first();

    if (
      !currentUserMembership ||
      (currentUserMembership.role !== "owner" &&
        currentUserMembership.role !== "admin")
    ) {
      throw createError(ErrorCode.INSUFFICIENT_PERMISSIONS);
    }

    // Get the membership to remove
    const membershipToRemove = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .first();

    if (!membershipToRemove) {
      throw createError(ErrorCode.NOT_ORGANIZATION_MEMBER);
    }

    // Can't remove the last owner
    if (membershipToRemove.role === "owner") {
      const owners = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => q.eq(q.field("role"), "owner"))
        .collect();

      if (owners.length === 1) {
        throw createError(ErrorCode.CANNOT_REMOVE_OWNER);
      }
    }

    await ctx.db.delete(membershipToRemove._id);
  },
});

export const switchOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED);
    }

    // Check if user is a member
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw createError(ErrorCode.NOT_ORGANIZATION_MEMBER);
    }

    // Update user's current organization
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (profile && profile.currentOrganizationId !== args.organizationId) {
      await ctx.db.patch(profile._id, {
        currentOrganizationId: args.organizationId,
        updatedAt: Date.now(),
      });
    }
  },
});
