import { internalMutation, internalQuery } from "../_generated/server";
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

// Read budget per cron tick. We walk this many candidate users (oldest
// first, capped at the 24h boundary) before yielding to the next tick;
// keeps Convex's per-transaction read budget bounded even when most
// scanned rows are kept legitimate users with profiles.
const CLEANUP_READ_BUDGET = 5000;

// Write budget per cron tick. Each delete fires 1 user delete + N auth
// session deletes (typically 1-3 per user), so 200 users × ~4 writes
// = ~800 writes — well under Convex's per-mutation write budget. The
// remainder rolls into the next cron tick. Lowered from 500 in response
// to a Gemini review flag about exceeding limits at peak concurrency.
const CLEANUP_DELETE_BUDGET = 200;

// Clean up incomplete users (users older than 24h without profiles).
// Uses the implicit `by_creation_time` system index to skip fresh rows.
//
// Decoupling read budget from delete budget addresses a degenerate case
// where the oldest CLEANUP_DELETE_BUDGET users all have profiles —
// previously the loop would stop at that hard cap and never reach the
// genuinely incomplete users behind them. Now we walk up to
// CLEANUP_READ_BUDGET rows, skip ones with profiles cheaply, and only
// stop the *delete* loop when CLEANUP_DELETE_BUDGET is hit.
export const cleanupIncompleteUsers = internalMutation({
  handler: async (ctx) => {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    let scanned = 0;
    let deletedCount = 0;

    for await (const user of ctx.db
      .query("users")
      .withIndex("by_creation_time")
      .order("asc")) {
      // Everything past this point is younger than 24h — bail out.
      if (user._creationTime > twentyFourHoursAgo) {
        break;
      }

      scanned++;
      if (scanned > CLEANUP_READ_BUDGET) {
        break;
      }

      // Skip users with profiles (legitimate accounts) cheaply via the
      // by_user index so they don't consume the delete budget.
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      if (profile) {
        continue;
      }

      // Delete orphaned auth sessions first — use the `userId` index
      // that `@convex-dev/auth` defines on `authSessions`.
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const session of sessions) {
        await ctx.db.delete(session._id);
      }
      await ctx.db.delete(user._id);
      deletedCount++;

      if (deletedCount >= CLEANUP_DELETE_BUDGET) {
        break;
      }
    }

    return { deletedCount, scanned };
  },
});
