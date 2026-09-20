import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

export const VERIFICATION_ADMISSION_CAPACITY = 600;
export const VERIFICATION_ADMISSION_REFILL_PER_SECOND = 10;
// Entitlement rechecks ask the store once per bound purchase. Their own bucket
// keeps a burst of access reads from starving receipt verification, and it is
// sized to the foreground share the Amazon reconciler leaves free (5 TPS).
export const ENTITLEMENT_RECHECK_CAPACITY = 300;
export const ENTITLEMENT_RECHECK_REFILL_PER_SECOND = 5;

export const admissionBucketValidator = v.union(
  v.literal("verification"),
  v.literal("entitlementRecheck"),
);
export type AdmissionBucket = "verification" | "entitlementRecheck";

const BUCKETS = {
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
} as const;

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

function bucketState(project: Doc<"projects">, bucket: AdmissionBucket) {
  return bucket === "verification"
    ? {
        tokens: project.verificationAdmissionTokens,
        refilledAt: project.verificationAdmissionRefilledAt,
      }
    : {
        tokens: project.entitlementRecheckTokens,
        refilledAt: project.entitlementRecheckRefilledAt,
      };
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
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const now = Date.now();
    const result = evaluateVerificationAdmission({
      ...bucketState(project, bucket),
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

    await ctx.db.patch(
      args.projectId,
      bucket === "verification"
        ? {
            verificationAdmissionTokens: result.tokens,
            verificationAdmissionRefilledAt: now,
          }
        : {
            entitlementRecheckTokens: result.tokens,
            entitlementRecheckRefilledAt: now,
          },
    );
    return null;
  },
});
