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

export default crons;
