import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { deletePurchaseStatsForProject } from "../purchases/stats";

// Per-phase page size for the account-deletion drain. Each
// `drainAccountDeletionBatch` call reads/writes at most a bounded multiple
// of this many rows, keeping the mutation well under Convex's
// per-transaction limits regardless of per-user volume (purchases,
// sessions, refresh tokens, etc.).
const ACCOUNT_DELETION_PAGE = 100;

// Internal query to get user by ID (read-only, so modeled as a query).
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    return {
      ...user,
      profile,
    };
  },
});

/**
 * Process one bounded slice of the current user's account teardown.
 *
 * The drain runs in priority order; each call makes one phase's worth
 * of progress and returns `{ done: false }` until the user's data tree
 * is empty (at which point the final call deletes the `users` row and
 * returns `{ done: true }`). The caller — `finalizeAccountDeletion`
 * action — loops on `done` to complete the teardown without ever
 * blowing a per-transaction budget.
 */
export const drainAccountDeletionBatch = internalMutation({
  args: { userId: v.id("users") },
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = args.userId;

    // Phase: refresh tokens + the session they belong to.
    const session = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (session) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .take(ACCOUNT_DELETION_PAGE);
      for (const token of tokens) {
        await ctx.db.delete(token._id);
      }
      if (tokens.length < ACCOUNT_DELETION_PAGE) {
        await ctx.db.delete(session._id);
      }
      return { done: false };
    }

    // Phase: verification codes + the auth account they belong to.
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .first();
    if (account) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .take(ACCOUNT_DELETION_PAGE);
      for (const code of codes) {
        await ctx.db.delete(code._id);
      }
      if (codes.length < ACCOUNT_DELETION_PAGE) {
        await ctx.db.delete(account._id);
      }
      return { done: false };
    }

    // Phase: user profile (at most one row).
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (profile) {
      await ctx.db.delete(profile._id);
      return { done: false };
    }

    // Phase: memberships — one at a time. Per membership, either mark
    // the org for deletion (sole member) or promote a new owner if
    // needed. Unbounded org-scoped data is drained in the next phase.
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (membership) {
      await ctx.db.delete(membership._id);

      const remaining = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", membership.organizationId),
        )
        .take(ACCOUNT_DELETION_PAGE);

      if (remaining.length === 0) {
        await ctx.db.patch(membership.organizationId, {
          pendingDeletion: true,
          updatedAt: Date.now(),
        });
      } else if (!remaining.some((m) => m.role === "owner")) {
        const sorted = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt);
        const replacement = sorted.find((m) => m.role === "admin") ?? sorted[0];
        if (replacement) {
          await ctx.db.patch(replacement._id, {
            role: "owner",
            updatedAt: Date.now(),
          });
        }
      }
      return { done: false };
    }

    // Phase: finally delete the user row itself. Orgs flagged by the
    // membership phase (sole-member case) are picked up by the
    // separate `drainPendingDeletionOrganizations` cron — running it
    // inside the user-deletion drain would let one user's account
    // teardown be indefinitely delayed by orphan-org backlog from
    // unrelated users.
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.delete(userId);
      return { done: false };
    }

    return { done: true };
  },
});

/**
 * Drain one bounded slice of any organization currently flagged
 * `pendingDeletion: true`. Run on a cron rather than inline in the
 * account-deletion path so a single user's teardown never has to
 * wait on global orphan-org cleanup.
 */
export const drainPendingDeletionOrganizations = internalMutation({
  args: {},
  returns: v.object({
    progressed: v.boolean(),
    deletedOrganizationId: v.union(v.id("organizations"), v.null()),
  }),
  handler: async (ctx) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_pending_deletion", (q) => q.eq("pendingDeletion", true))
      .first();
    if (!org) {
      return { progressed: false, deletedOrganizationId: null };
    }
    const madeProgress = await drainOrganizationPage(ctx, org._id);
    if (!madeProgress) {
      // Stripe customer teardown is no longer needed after the free
      // transition; legacy stripeCustomerId values are left as-is.
      await ctx.db.delete(org._id);
      return { progressed: true, deletedOrganizationId: org._id };
    }
    return { progressed: true, deletedOrganizationId: null };
  },
});

/**
 * Delete one bounded page of an orphaned organization's data. Returns
 * `true` if work was done (more remains, caller should loop) or
 * `false` when the org has nothing else attached (caller should then
 * delete the org row itself).
 */
async function drainOrganizationPage(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<boolean> {
  // Walk projects one at a time — within a project drain purchases,
  // apiKeys, files in order.
  const project = await ctx.db
    .query("projects")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
  if (project) {
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(ACCOUNT_DELETION_PAGE);
    for (const purchase of purchases) {
      await ctx.db.delete(purchase._id);
    }
    if (purchases.length >= ACCOUNT_DELETION_PAGE) {
      return true;
    }

    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(ACCOUNT_DELETION_PAGE);
    for (const apiKey of apiKeys) {
      await ctx.db.delete(apiKey._id);
    }
    if (apiKeys.length >= ACCOUNT_DELETION_PAGE) {
      return true;
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(ACCOUNT_DELETION_PAGE);
    for (const file of files) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }
    if (files.length >= ACCOUNT_DELETION_PAGE) {
      return true;
    }

    await deletePurchaseStatsForProject(ctx, project._id);
    await ctx.db.delete(project._id);
    return true;
  }

  // Project-less org — drain org-scoped side tables.
  const orgApiKeys = await ctx.db
    .query("apiKeys")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .take(ACCOUNT_DELETION_PAGE);
  for (const apiKey of orgApiKeys) {
    await ctx.db.delete(apiKey._id);
  }
  if (orgApiKeys.length > 0) {
    return true;
  }

  const orgFiles = await ctx.db
    .query("files")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .take(ACCOUNT_DELETION_PAGE);
  for (const file of orgFiles) {
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
  }
  if (orgFiles.length > 0) {
    return true;
  }

  const accruals = await ctx.db
    .query("meteredUsageAccruals")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .take(ACCOUNT_DELETION_PAGE);
  for (const accrual of accruals) {
    await ctx.db.delete(accrual._id);
  }
  if (accruals.length > 0) {
    return true;
  }

  const stripeEvents = await ctx.db
    .query("stripeEvents")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .take(ACCOUNT_DELETION_PAGE);
  for (const event of stripeEvents) {
    await ctx.db.delete(event._id);
  }
  if (stripeEvents.length > 0) {
    return true;
  }

  // Clear `currentOrganizationId` references on other users' profiles.
  const referencingProfiles = await ctx.db
    .query("userProfiles")
    .withIndex("by_current_organization", (q) =>
      q.eq("currentOrganizationId", organizationId),
    )
    .take(ACCOUNT_DELETION_PAGE);
  for (const p of referencingProfiles) {
    await ctx.db.patch(p._id, {
      currentOrganizationId: undefined,
      updatedAt: Date.now(),
    });
  }
  if (referencingProfiles.length > 0) {
    return true;
  }

  return false;
}

// Internal mutation to update user's current organization
export const updateCurrentOrganization = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    await ctx.db.patch(profile._id, {
      currentOrganizationId: args.organizationId,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});
