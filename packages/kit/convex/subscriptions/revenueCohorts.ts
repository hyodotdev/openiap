// Monthly cohorts rebuilt once a day from `subscriptions.analytics`, so the
// dashboard reads a few rows instead of scanning subscriptions.
//
// - Paid cohort: subscriptions whose first paid charge fell in a UTC month and
//   began as a direct paid start or a trial conversion. A subscription whose
//   first observed charge was a renewal, or an Apple resubscribe with no trial
//   before it, started before IAPKit saw it and is left out rather than
//   placed in the wrong month.
// - retained[k]: members with paid access at the end of cohort month + k (at
//   the observation time for the current month). A canceled subscription stays
//   retained until its paid period ends; a refund ends it at the refund.
// - Realized LTV: gross list price of the members' observed paid charges over
//   members. It is never projected forward.
// - Trial cohort: free trials started in the month, how many converted to a
//   paid charge, and how many are still in their trial.

import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getWritableProject } from "../projects/writable";
import { receiptEnvironmentValidator } from "../utils/validation";
import { isMisrecordedApplePass } from "./stateMachine";
import {
  isInTrialAt,
  paidStartKind,
  subscriptionEnvironment,
} from "./analyticsFacts";

export const COHORT_MONTHS = 24;
const COHORT_PAGE_SIZE = 5_000;

const cohortBucketValidator = v.object({
  environment: receiptEnvironmentValidator,
  month: v.string(),
  currency: v.string(),
  members: v.number(),
  revenueMicros: v.number(),
  refundedMicros: v.number(),
  retained: v.array(v.number()),
  trialStarts: v.number(),
  trialConversions: v.number(),
  trialsPending: v.number(),
});

export type CohortBucket = Infer<typeof cohortBucketValidator>;

export function utcMonthKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 7);
}

function monthIndex(month: string): number {
  const [year, monthOfYear] = month.split("-").map(Number);
  return year * 12 + (monthOfYear - 1);
}

// First millisecond after the month `offset` months past `month`.
function monthEnd(month: string, offset: number): number {
  const index = monthIndex(month) + offset + 1;
  return Date.UTC(Math.floor(index / 12), index % 12, 1);
}

function hasAccessAt(sub: Doc<"subscriptions">, at: number): boolean {
  return (
    (sub.state === "Active" || sub.state === "InGracePeriod") &&
    (sub.expiresAt === undefined || sub.expiresAt > at)
  );
}

// When paid access ended, from current state: the paid-through date, or the
// refund for a refunded or revoked row. A lapse later healed by a resubscribe
// on the same store subscription reads as continuous.
export function accessEndsAt(sub: Doc<"subscriptions">): number {
  const lastChange = sub.lastEventOccurredAt ?? sub.updatedAt;
  if (sub.state === "Revoked" || sub.state === "Refunded") {
    return Math.min(sub.expiresAt ?? Infinity, lastChange);
  }
  if (sub.expiresAt !== undefined) return sub.expiresAt;
  return sub.state === "Active" || sub.state === "InGracePeriod"
    ? Infinity
    : lastChange;
}

export function addSubscriptionToCohorts(
  buckets: Map<string, CohortBucket>,
  sub: Doc<"subscriptions">,
  asOf: number,
): void {
  const facts = sub.analytics;
  if (!facts || sub.store === "amazon" || isMisrecordedApplePass(sub)) return;
  const firstMonth = utcMonthKey(monthEnd(utcMonthKey(asOf), -COHORT_MONTHS));
  const environment = subscriptionEnvironment(sub);
  const currency = facts.currency ?? sub.currency ?? "";
  const bucketFor = (month: string): CohortBucket => {
    const key = `${environment}|${month}|${currency}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        environment,
        month,
        currency,
        members: 0,
        revenueMicros: 0,
        refundedMicros: 0,
        retained: [],
        trialStarts: 0,
        trialConversions: 0,
        trialsPending: 0,
      };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  const trialStartedAt = facts.trialStartedAt;
  if (trialStartedAt !== undefined && trialStartedAt <= asOf) {
    const month = utcMonthKey(trialStartedAt);
    if (month >= firstMonth) {
      const bucket = bucketFor(month);
      bucket.trialStarts += 1;
      if (isInTrialAt(facts, asOf)) {
        if (hasAccessAt(sub, asOf)) bucket.trialsPending += 1;
      } else if (paidStartKind(facts) === "trial_conversion") {
        bucket.trialConversions += 1;
      }
    }
  }

  const firstPaidAt = facts.firstPaidAt;
  if (
    firstPaidAt === undefined ||
    firstPaidAt > asOf ||
    !paidStartKind(facts)
  ) {
    return;
  }
  const month = utcMonthKey(firstPaidAt);
  if (month < firstMonth) return;
  const bucket = bucketFor(month);
  bucket.members += 1;
  bucket.revenueMicros += facts.paidMicros;
  bucket.refundedMicros += facts.refundedMicros;
  const endsAt = accessEndsAt(sub);
  const offsets = monthIndex(utcMonthKey(asOf)) - monthIndex(month);
  for (let k = 0; k <= offsets; k++) {
    const at = Math.min(monthEnd(month, k) - 1, asOf);
    bucket.retained[k] = (bucket.retained[k] ?? 0) + (endsAt > at ? 1 : 0);
  }
}

export const recomputeRevenueCohortsPage = internalMutation({
  args: {
    projectId: v.id("projects"),
    asOf: v.number(),
    cursor: v.union(v.string(), v.null()),
    buckets: v.array(cohortBucketValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runRevenueCohortsPage(ctx, args);
    return null;
  },
});

// One page of the project's subscriptions per mutation, then the commit, which
// replaces every cohort row of the project.
export async function runRevenueCohortsPage(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    asOf: number;
    cursor: string | null;
    buckets: CohortBucket[];
  },
): Promise<void> {
  if (!(await getWritableProject(ctx, args.projectId))) return;
  const buckets = new Map<string, CohortBucket>(
    args.buckets.map((bucket) => [
      `${bucket.environment}|${bucket.month}|${bucket.currency}`,
      { ...bucket, retained: [...bucket.retained] },
    ]),
  );
  const result = await ctx.db
    .query("subscriptions")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .paginate({ numItems: COHORT_PAGE_SIZE, cursor: args.cursor });
  for (const sub of result.page) {
    addSubscriptionToCohorts(buckets, sub, args.asOf);
  }

  if (!result.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.subscriptions.revenueCohorts.recomputeRevenueCohortsPage,
      {
        projectId: args.projectId,
        asOf: args.asOf,
        cursor: result.continueCursor,
        buckets: Array.from(buckets.values()),
      },
    );
    return;
  }

  // At most COHORT_MONTHS × 2 environments × currencies rows per project.
  const existing = await ctx.db
    .query("revenueCohortsMonthly")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .collect();
  await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
  const observedThrough = new Date(args.asOf).toISOString().slice(0, 10);
  await Promise.all(
    Array.from(buckets.values()).map((bucket) =>
      ctx.db.insert("revenueCohortsMonthly", {
        projectId: args.projectId,
        ...bucket,
        observedThrough,
        updatedAt: args.asOf,
      }),
    ),
  );
  const status = await ctx.db
    .query("revenueMetricsRunStatus")
    .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
    .unique();
  if (status) {
    await ctx.db.patch(status._id, { cohortsComputedAt: args.asOf });
  }
}
