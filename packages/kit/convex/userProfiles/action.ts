import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

// Cap per action invocation. With `ACCOUNT_DELETION_PAGE=100` that's
// enough to drain ~50k rows in one action — more than any realistic
// account. If a genuinely huge account exceeds this, we self-schedule
// a follow-up invocation to keep going.
const MAX_DRAIN_ITERATIONS = 500;

/**
 * Finalize the teardown kicked off by `deleteAccount`.
 *
 * Loops the `drainAccountDeletionBatch` mutation — which processes one
 * bounded phase per call — until the user's data tree is fully deleted.
 * Keeping the heavy loop in an action means individual mutations stay
 * inside Convex's per-transaction limits regardless of how much data
 * the account had accumulated (dominant concern: per-project receipt
 * volume, which is unbounded in principle).
 *
 * Resumable: if this action crashes or hits the `MAX_DRAIN_ITERATIONS`
 * cap mid-drain, it re-schedules itself. The mutation is idempotent —
 * subsequent calls pick up whatever rows are still present in the
 * pending-deletion phases.
 */
export const finalizeAccountDeletion = internalAction({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (let i = 0; i < MAX_DRAIN_ITERATIONS; i++) {
      const { done } = await ctx.runMutation(
        internal.userProfiles.internal.drainAccountDeletionBatch,
        { userId: args.userId },
      );
      if (done) {
        return null;
      }
    }

    // Didn't finish within this action's budget — hand off to a fresh
    // invocation so the drain keeps making progress.
    await ctx.scheduler.runAfter(
      0,
      internal.userProfiles.action.finalizeAccountDeletion,
      { userId: args.userId },
    );
    return null;
  },
});
