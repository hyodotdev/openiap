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

// Grace-period gate: email OTP is only for accounts that already used it.
// A GitHub-created account must keep using GitHub even before the cutoff.
export const RESEND_PROVIDER_IDS = [
  "resend-otp-en",
  "resend-otp-ko",
  "resend-otp-ja",
] as const;

export async function hasAnyResendAccount(
  findAccount: (provider: string) => Promise<object | null>,
): Promise<boolean> {
  for (const provider of RESEND_PROVIDER_IDS) {
    if ((await findAccount(provider)) !== null) return true;
  }
  return false;
}

export const hasLegacyEmailAccount = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) =>
    hasAnyResendAccount((provider) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", args.userId).eq("provider", provider),
        )
        .first(),
    ),
});

// Candidate users read per tick, oldest first, up to the 24h boundary.
const CLEANUP_READ_BUDGET = 5000;

// Deletes per tick: ~4 writes each (the user plus 1-3 sessions), ~800 in all,
// well under the write limit. The rest waits for the next tick.
const CLEANUP_DELETE_BUDGET = 200;

const CLEANUP_JOB_NAME = "cleanupIncompleteUsers";

// Deletes users older than 24h that never got a profile. A creation-time cursor
// persists between ticks: without it, once more profiled users than the read
// budget passed 24h, every tick would spend its budget on them and never reach
// the incomplete signups behind. The cursor moves past profiled users and after
// each successful delete, and parks at the 24h boundary (minus a small slack)
// once caught up.
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
