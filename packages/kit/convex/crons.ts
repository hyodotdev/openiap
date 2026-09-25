import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { WEBHOOK_RETENTION_MS } from "./webhooks/internal";
import { COMMERCE_EVENT_RETENTION_MS } from "./commerce/signing";

const crons = cronJobs();

crons.monthly(
  "reset monthly request counts",
  {
    day: 1,
    hourUTC: 0,
    minuteUTC: 0,
  },
  internal.organizations.internal.resetMonthlyRequestCounts,
);

// Clean up incomplete users daily (users without profiles after 24 hours)
crons.daily(
  "cleanup incomplete users",
  {
    hourUTC: 3, // 3 AM UTC = 12 PM KST
    minuteUTC: 0,
  },
  internal.users.internal.cleanupIncompleteUsers,
);

// Separate from user-account deletion so a user's teardown never waits on
// the orphan-org backlog. Each tick drains one bounded page of one org;
// every 5 minutes clears a queue in minutes, not hours.
crons.interval(
  "drain pending-deletion organizations",
  { minutes: 5 },
  internal.userProfiles.internal.drainPendingDeletionOrganizations,
);

// Recovery sweep: direct project deletion schedules its own continuation
// after each bounded page, and this resumes a project left pending when a
// scheduled function was cancelled or failed.
crons.interval(
  "drain pending-deletion projects",
  { minutes: 5 },
  internal.projects.internal.drainPendingProjectDeletion,
);

// Upload reservations are one-time bearer capabilities used to close the
// signed-upload/account-deletion race. Successful and rejected save attempts
// consume them immediately; this sweep bounds abandoned reservations.
crons.interval(
  "prune expired file upload reservations",
  { hours: 1 },
  internal.files.internal.pruneUploadReservations,
  {},
);

crons.interval(
  "resume Google service-account cleanup",
  { minutes: 5 },
  internal.files.mutation.resumeGoogleServiceAccountCleanup,
  {},
);

// 30-day retention, pruned hourly in small batches so stored lifecycle
// history and analytics reads stay bounded.
crons.interval(
  "prune webhook events past retention",
  { hours: 1 },
  internal.webhooks.internal.pruneWebhookEvents,
  { olderThanMs: WEBHOOK_RETENTION_MS },
);

// Outbound delivery of normalized commerce events to developer-registered
// endpoints. One minute keeps first-attempt latency low; the per-row lease
// stops overlapping ticks from double-delivering.
crons.interval(
  "deliver commerce events",
  { minutes: 1 },
  internal.commerce.delivery.deliverPendingEvents,
  {},
);

crons.interval(
  "resume pending commerce destination removal",
  { minutes: 5 },
  internal.commerce.destinations.resumePendingDestinationRemoval,
  {},
);

crons.interval(
  "prune delivered commerce events past retention",
  { hours: 1 },
  internal.commerce.deliveryState.pruneCommerceHistory,
  { olderThanMs: COMMERCE_EVENT_RETENTION_MS },
);

crons.interval(
  "erase expired commerce webhook secrets",
  { hours: 1 },
  internal.commerce.destinations.pruneExpiredPreviousSecrets,
  {},
);

// Amazon recommends checking every active RVS receipt within 72 hours.
// Rows become due on a 48-hour cadence; the bounded worker processes at most
// 20 per tick, so backlog and retries can delay completion beyond that target.
crons.interval(
  "reconcile amazon purchases",
  { minutes: 5 },
  internal.purchases.amazon.reconcileAmazonPurchases,
  {},
);

// `subscriptionStats` is maintained incrementally by applySubscriptionEvent,
// which is correct in steady state but drifts after a missed invocation
// (action timeout, manual db.patch, schema drift during rollout).
// Recomputing the most-stale projects daily heals it without an operator.
crons.interval(
  "recompute subscription stats (drift correction)",
  { hours: 24 },
  internal.subscriptions.stats.recomputeAllSubscriptionStats,
  // Each project recomputes in its own scheduled mutation (own 40k-read
  // budget), so the picker is an index scan plus 50 schedule calls. 50 a
  // day cycles up to 1,500 projects at least monthly.
  { batchSize: 50 },
);

// User-erasure mutations schedule their own bounded continuation. This sweep
// resumes queued or stale work after a cancelled scheduled function.
crons.interval(
  "resume subscription user erasure",
  { minutes: 5 },
  internal.subscriptions.internal.resumeSubscriptionUserErasureJobs,
  {},
);

crons.interval(
  "prune completed subscription user erasure jobs",
  { hours: 6 },
  internal.subscriptions.internal.pruneCompletedSubscriptionUserErasureJobs,
  {},
);

// Rebuilds the `revenueMetricsDaily` rows behind the Analytics dashboard
// from the last 3 days of `webhookEvents`. The window covers Apple ASN v2
// and Google RTDN late retries (real-world p99 < 48h), so a webhook up to 3
// days late still lands in its day's bucket.
//
// Every 10 minutes, not daily: daily at batchSize 50 took 10 days to cycle
// 500 projects. The picker rotates through `revenueMetricsRunStatus.by_run`
// at any cadence, and each project recomputes in its own scheduled mutation
// (own 40k-read budget). 100 × 6/hour × 24h = 14,400 project-runs a day,
// keeping a typical deployment current within minutes.
crons.interval(
  "recompute revenue metrics",
  { minutes: 10 },
  internal.subscriptions.revenueMetrics.recomputeAllRevenueMetrics,
  { batchSize: 100 },
);

// Convex caps actions at ~10 minutes. The worker sets `expectedDeadline` to
// startedAt + 9 minutes, and this fails any job still `running` a minute
// past it; otherwise a crashed action holds the project's active-job slot
// forever and the dashboard's sync button stays disabled.
crons.interval(
  "reap stale product sync jobs",
  { minutes: 5 },
  internal.products.jobs.reapStaleProductSyncJobs,
);

// Drop succeeded jobs after 7d, failed after 30d.
crons.interval(
  "prune product sync jobs past retention",
  { hours: 6 },
  internal.products.jobs.pruneProductSyncJobs,
);

export default crons;
