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
// keeps Convex's per-transaction read budget bounded.
const CLEANUP_READ_BUDGET = 5000;

// Write budget per cron tick. Each delete fires 1 user delete + N auth
// session deletes (typically 1-3 per user), so 200 users × ~4 writes
// = ~800 writes — well under Convex's per-mutation write budget. The
// remainder rolls into the next cron tick.
const CLEANUP_DELETE_BUDGET = 200;

const CLEANUP_JOB_NAME = "cleanupIncompleteUsers";

// Clean up incomplete users (users older than 24h without profiles).
//
// We persist a creation-time cursor between ticks so the loop doesn't
// repeatedly scan the same legitimate-user prefix on every run. Without
// the cursor, once N legit users had aged past 24h (where N exceeds the
// read budget), the cleanup would burn its entire budget on profiled
// users and never reach genuinely incomplete signups behind them.
//
// Each tick:
//   1. Resume past `cursor` (last successfully-processed user).
//   2. Walk by `_creationTime` ascending up to the read budget.
//   3. Skip users with profiles via the `by_user` index (they're
//      legitimate accounts) and advance the cursor past them.
//   4. Delete profile-less users + their auth sessions, advancing the
//      cursor only after a successful delete.
//   5. When we cross the 24h boundary, advance the cursor to the
//      boundary minus a small slack — "nothing left to do for now",
//      next tick picks up newly-aged users.
export const cleanupIncompleteUsers = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const stateDoc = await ctx.db
      .query("cronState")
      .withIndex("by_jobName", (q) => q.eq("jobName", CLEANUP_JOB_NAME))
      .first();
    const cursor = stateDoc?.cursor ?? 0;

    let advancedTo = cursor;
    let scanned = 0;
    let deletedCount = 0;
    let reachedBoundary = false;

    for await (const user of ctx.db
      .query("users")
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", cursor))
      .order("asc")) {
      // Past this point everything is too fresh — finish the run.
      if (user._creationTime > twentyFourHoursAgo) {
        reachedBoundary = true;
        break;
      }

      // Stop *before* incrementing scanned/advanceTo so unprocessed
      // users stay queued for the next tick.
      if (scanned >= CLEANUP_READ_BUDGET) {
        break;
      }
      if (deletedCount >= CLEANUP_DELETE_BUDGET) {
        break;
      }

      scanned++;

      // Skip users with profiles cheaply via the by_user index. Advance
      // the cursor past them so the next tick doesn't re-scan.
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
      if (profile) {
        advancedTo = user._creationTime;
        continue;
      }

      // Profile-less and older than 24h → delete user + sessions.
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .collect();
      for (const session of sessions) {
        await ctx.db.delete(session._id);
      }
      await ctx.db.delete(user._id);
      deletedCount++;
      advancedTo = user._creationTime;
    }

    // If we exhausted the iterator past the 24h boundary, we're "caught
    // up" for this tick — park the cursor right at the boundary so the
    // next run resumes only against newly-aged rows.
    if (reachedBoundary) {
      advancedTo = Math.max(advancedTo, twentyFourHoursAgo);
    }

    if (stateDoc) {
      await ctx.db.patch(stateDoc._id, {
        cursor: advancedTo,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("cronState", {
        jobName: CLEANUP_JOB_NAME,
        cursor: advancedTo,
        updatedAt: now,
      });
    }

    return { deletedCount, scanned, cursorAdvancedTo: advancedTo };
  },
});
