import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

// Batches per action run, more than a realistic account needs; a larger one
// reschedules the action to continue.
const MAX_DRAIN_ITERATIONS = 500;
// A failed batch retries after 1, 2, 4, 8, 16 and 32 minutes, then gives up.
const MAX_FAILED_RUNS = 6;
const FIRST_RETRY_DELAY_MS = 60_000;

/**
 * Finishes the teardown `deleteAccount` started, calling
 * `drainAccountDeletionBatch` (one bounded phase per call) until nothing is
 * left, so no mutation exceeds Convex's limits however much the account holds.
 *
 * Resumable: after a failed batch or the `MAX_DRAIN_ITERATIONS` cap it
 * reschedules itself, and the idempotent mutation picks up whatever remains.
 */
export const finalizeAccountDeletion = internalAction({
  args: { userId: v.id("users"), failures: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      for (let i = 0; i < MAX_DRAIN_ITERATIONS; i++) {
        const { done } = await ctx.runMutation(
          internal.userProfiles.internal.drainAccountDeletionBatch,
          { userId: args.userId },
        );
        if (done) {
          return null;
        }
      }
    } catch (error) {
      const failures = (args.failures ?? 0) + 1;
      if (failures <= MAX_FAILED_RUNS) {
        await ctx.scheduler.runAfter(
          FIRST_RETRY_DELAY_MS * 2 ** (failures - 1),
          internal.userProfiles.action.finalizeAccountDeletion,
          { userId: args.userId, failures },
        );
      }
      throw error;
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
