import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Reset monthly request counts at the beginning of each month
crons.monthly(
  "reset monthly request counts",
  {
    day: 1, // First day of the month
    hourUTC: 0, // Midnight UTC
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

// Drain organizations flagged `pendingDeletion: true`. Runs separately
// from the user-account-deletion path so an individual user's teardown
// never blocks on global orphan-org backlog. Each tick processes one
// org one bounded page at a time; we run every 5 minutes so a deletion
// queue clears within minutes, not hours.
crons.interval(
  "drain pending-deletion organizations",
  { minutes: 5 },
  internal.userProfiles.internal.drainPendingDeletionOrganizations,
);

// Prune webhook events older than the 30-day retention window so the
// `webhookEventsSince` backfill query stays bounded. Runs hourly with
// a small per-tick batch size — webhook traffic is low-volume per
// project so even a tight batch keeps the table from growing
// unbounded. Matches the retention promise documented in
// `packages/gql/src/webhook.graphql`.
crons.interval(
  "prune webhook events past retention",
  { hours: 1 },
  internal.webhooks.internal.pruneWebhookEvents,
  { olderThanMs: 30 * 24 * 60 * 60 * 1000 },
);

// Meta Horizon Store has no webhook system — Meta only exposes a
// synchronous `verify_entitlement` Graph API. We poll every 6h to
// reconcile Active / InGracePeriod / Paused subscriptions against
// Meta's authoritative answer, feeding the deltas through the same
// state machine the Apple/Google webhook receivers use.
crons.interval(
  "reconcile horizon entitlements",
  { hours: 6 },
  internal.subscriptions.horizon.reconcileHorizonEntitlements,
  {},
);

export default crons;
