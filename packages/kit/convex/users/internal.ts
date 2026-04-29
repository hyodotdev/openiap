import { internalMutation, internalQuery } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";

// Indexed lookup of a user by email. Called from `auth.ts` where the ctx is
// typed against AnyDataModel and cannot see the `email` index on `users`.
export const findByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Max users this cron scans per tick. Keeps the mutation under Convex's
// per-transaction read/write limits even as the `users` table grows; the
// next cron run picks up whatever wasn't processed.
const CLEANUP_SCAN_BATCH_SIZE = 500;

// Clean up incomplete users (users without profiles after 24 hours).
// Uses the implicit `by_creation_time` system index to skip fresh rows
// and caps the scan so growth in `users` doesn't blow the transaction.
export const cleanupIncompleteUsers = internalMutation({
  handler: async (ctx) => {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Walk users by creation time ascending and stop once we cross the
    // 24-hour boundary — everything after is too fresh to delete.
    const candidates: Array<Doc<"users">> = [];
    for await (const user of ctx.db
      .query("users")
      .withIndex("by_creation_time")
      .order("asc")) {
      if (user._creationTime > twentyFourHoursAgo) {
        break;
      }
      candidates.push(user);
      if (candidates.length >= CLEANUP_SCAN_BATCH_SIZE) {
        break;
      }
    }

    let deletedCount = 0;

    for (const user of candidates) {
      // Check if user has a profile
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();

      // If no profile exists after 24 hours, delete the user
      if (!profile) {
        // Also delete any orphaned auth sessions — use the `userId`
        // index that `@convex-dev/auth` defines on `authSessions` so
        // this stays fast as the table grows.
        const sessions = await ctx.db
          .query("authSessions")
          .withIndex("userId", (q) => q.eq("userId", user._id))
          .collect();

        for (const session of sessions) {
          await ctx.db.delete(session._id);
        }

        // Delete the user
        await ctx.db.delete(user._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  },
});
