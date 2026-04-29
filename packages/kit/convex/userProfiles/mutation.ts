import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";

// Create or update user profile (called from auth callbacks)
export const createOrUpdateProfile = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    loginMethod: v.string(),
    isGitHub: v.boolean(),
    githubUsername: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if profile exists
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    // Determine login method type
    let loginMethodType: "email" | "github" | "email-github" | "none" = "none";

    if (existingProfile) {
      const currentMethod = existingProfile.loginMethodType || "none";

      if (args.isGitHub && !currentMethod.includes("github")) {
        loginMethodType = currentMethod === "email" ? "email-github" : "github";
      } else if (!args.isGitHub && !currentMethod.includes("email")) {
        loginMethodType = currentMethod === "github" ? "email-github" : "email";
      } else {
        loginMethodType = currentMethod;
      }

      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        loginMethodType,
        lastLoginMethod: args.loginMethod,
        lastLoginAt: Date.now(),
        ...(args.githubUsername ? { githubUsername: args.githubUsername } : {}),
        updatedAt: Date.now(),
      });

      return existingProfile._id;
    }

    // Create new profile
    const displayName = args.name || args.email.split("@")[0];

    const profileId = await ctx.db.insert("userProfiles", {
      userId: args.userId,
      displayName,
      locale: "en",
      loginMethodType: args.isGitHub ? "github" : "email",
      lastLoginMethod: args.loginMethod,
      lastLoginAt: Date.now(),
      ...(args.githubUsername ? { githubUsername: args.githubUsername } : {}),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return profileId;
  },
});

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
 * Tear the current user's account down.
 *
 * The mutation itself is deliberately light: it schedules
 * `finalizeAccountDeletion` and returns. The action then loops
 * bounded `drainAccountDeletionBatch` mutations that walk a priority
 * list (refresh tokens → sessions → verification codes → auth
 * accounts → profile → memberships → orphaned orgs with their
 * projects/purchases/files) a fixed page at a time. Purchase volume
 * per project is the one truly unbounded axis, so the drain never
 * tries to delete all purchases inside a single transaction.
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
