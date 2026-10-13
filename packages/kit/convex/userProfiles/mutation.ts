import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";

// Ensure user profile exists for authenticated user
export const ensureUserProfile = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Check if profile already exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingProfile) {
      return existingProfile._id;
    }

    // Get user data from auth users table
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Create new profile
    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      displayName: user.name || user.email?.split("@")[0] || "User",
      locale: "en", // Default locale
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return profileId;
  },
});

// Update display name
export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Check if display name is already taken
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_display_name", (q) =>
        q.eq("displayName", args.displayName),
      )
      .first();

    if (existingProfile && existingProfile._id !== profile._id) {
      throw new Error("Display name already taken");
    }

    await ctx.db.patch(profile._id, {
      displayName: args.displayName,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});

// Update user locale
export const updateLocale = mutation({
  args: { locale: v.union(v.literal("en"), v.literal("ko"), v.literal("ja")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    await ctx.db.patch(profile._id, {
      locale: args.locale,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});

/**
 * Tears down the current user's account. Only schedules
 * `finalizeAccountDeletion`, which runs bounded `drainAccountDeletionBatch`
 * mutations through a priority list (refresh tokens, sessions, verification
 * codes, auth accounts, profile, memberships, orphaned orgs with their
 * projects, purchases and files) a page at a time, since purchase volume per
 * project is unbounded.
 */
export const deleteAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("User not authenticated");
    }

    await ctx.scheduler.runAfter(
      0,
      internal.userProfiles.action.finalizeAccountDeletion,
      { userId },
    );

    return null;
  },
});
