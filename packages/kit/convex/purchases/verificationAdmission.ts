import { ConvexError, v, type Infer } from "convex/values";

import { internalMutation } from "../_generated/server";
import { admissionBucketValidator } from "../utils/validation";

export const VERIFICATION_ADMISSION_CAPACITY = 600;
export const VERIFICATION_ADMISSION_REFILL_PER_SECOND = 10;
// Entitlement rechecks ask the store once per bound purchase. Their own bucket
// keeps a burst of access reads from starving receipt verification, and it is
// sized to the foreground share the Amazon reconciler leaves free (5 TPS).
export const ENTITLEMENT_RECHECK_CAPACITY = 300;
export const ENTITLEMENT_RECHECK_REFILL_PER_SECOND = 5;
// Operator re-syncs get their own small bucket, so a bulk re-sync from a script
// or an agent cannot drain the one fail-closed entitlement reads depend on.
export const STORE_RESYNC_CAPACITY = 60;
export const STORE_RESYNC_REFILL_PER_SECOND = 1;

type AdmissionBucket = Infer<typeof admissionBucketValidator>;

const BUCKETS: Record<
  AdmissionBucket,
  { capacity: number; refillPerSecond: number; message: string }
> = {
  verification: {
    capacity: VERIFICATION_ADMISSION_CAPACITY,
    refillPerSecond: VERIFICATION_ADMISSION_REFILL_PER_SECOND,
    message: "Too many verification requests",
  },
  entitlementRecheck: {
    capacity: ENTITLEMENT_RECHECK_CAPACITY,
    refillPerSecond: ENTITLEMENT_RECHECK_REFILL_PER_SECOND,
    message: "Too many entitlement rechecks",
  },
  storeResync: {
    capacity: STORE_RESYNC_CAPACITY,
    refillPerSecond: STORE_RESYNC_REFILL_PER_SECOND,
    message: "Too many store re-syncs",
  },
};

export function evaluateVerificationAdmission(args: {
  tokens: number | undefined;
  refilledAt: number | undefined;
  now: number;
  cost?: number;
  capacity?: number;
  refillPerSecond?: number;
}):
  | { admitted: true; tokens: number }
  | { admitted: false; retryAfterSec: number } {
  const cost = args.cost ?? 1;
  const capacity = args.capacity ?? VERIFICATION_ADMISSION_CAPACITY;
  const refillPerSecond =
    args.refillPerSecond ?? VERIFICATION_ADMISSION_REFILL_PER_SECOND;
  const elapsedSeconds = Math.max(
    0,
    (args.now - (args.refilledAt ?? args.now)) / 1_000,
  );
  const available = Math.min(
    capacity,
    (args.tokens ?? capacity) + elapsedSeconds * refillPerSecond,
  );
  if (available < cost) {
    return {
      admitted: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((cost - available) / refillPerSecond),
      ),
    };
  }
  return { admitted: true, tokens: available - cost };
}

export const consume = internalMutation({
  args: {
    projectId: v.id("projects"),
    bucket: v.optional(admissionBucketValidator),
    cost: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bucket = args.bucket ?? "verification";
    const { capacity, refillPerSecond, message } = BUCKETS[bucket];
    const cost = args.cost ?? 1;
    if (!Number.isInteger(cost) || cost < 1 || cost > capacity)
      throw new Error("Admission cost is outside the bucket capacity");
    if (!(await ctx.db.get(args.projectId))) {
      throw new Error("Project not found");
    }
    const state = await ctx.db
      .query("verificationAdmissionBuckets")
      .withIndex("by_project_and_bucket", (q) =>
        q.eq("projectId", args.projectId).eq("bucket", bucket),
      )
      .unique();

    const now = Date.now();
    const result = evaluateVerificationAdmission({
      tokens: state?.tokens,
      refilledAt: state?.refilledAt,
      now,
      cost,
      capacity,
      refillPerSecond,
    });
    if (!result.admitted) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message,
        retryAfterSec: result.retryAfterSec,
      });
    }

    if (state) {
      await ctx.db.patch(state._id, { tokens: result.tokens, refilledAt: now });
    } else {
      await ctx.db.insert("verificationAdmissionBuckets", {
        projectId: args.projectId,
        bucket,
        tokens: result.tokens,
        refilledAt: now,
      });
    }
    return null;
  },
});
