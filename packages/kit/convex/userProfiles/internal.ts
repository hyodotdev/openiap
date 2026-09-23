import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { deleteProjectWithData } from "../projects/helpers";
import {
  deleteFileAndStorageIfUnreferenced,
  deleteStorageIfUnreferenced,
} from "../files/storage";

// Rows per account-deletion phase. Auth tokens, Stripe payloads and org or file
// metadata can be large; ten maximum-size documents stay under Convex's 16 MiB
// transaction read limit.
const ACCOUNT_DELETION_PAGE = 10;

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
 * One bounded slice of a user's account teardown, one phase at a time in
 * priority order. Returns `{ done: false }` until the final call deletes the
 * `users` row; `finalizeAccountDeletion` loops on `done`.
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
      } else {
        // `remaining` is deliberately bounded. An owner may sit beyond that
        // page, so use a role-keyed exact lookup before promoting anyone;
        // otherwise reducing the deletion page size could create two owners.
        const existingOwner = await ctx.db
          .query("organizationMembers")
          .withIndex("by_organization_and_role", (q) =>
            q
              .eq("organizationId", membership.organizationId)
              .eq("role", "owner"),
          )
          .first();
        if (existingOwner) return { done: false };

        const sorted = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt);
        const existingAdmin = await ctx.db
          .query("organizationMembers")
          .withIndex("by_organization_and_role", (q) =>
            q
              .eq("organizationId", membership.organizationId)
              .eq("role", "admin"),
          )
          .first();
        const replacement = existingAdmin ?? sorted[0];
        if (replacement) {
          await ctx.db.patch(replacement._id, {
            role: "owner",
            updatedAt: Date.now(),
          });
        }
      }
      return { done: false };
    }

    // Last, the user row. Orgs flagged above are left to
    // drainPendingDeletionOrganizations.
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.delete(userId);
      return { done: false };
    }

    return { done: true };
  },
});

/**
 * One bounded slice of an organization flagged `pendingDeletion`. A cron, not
 * part of the account drain, so one user's teardown never waits on other users'
 * orphan orgs.
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
      // Legacy stripeCustomerId values stay; Stripe needs no teardown.
      const avatarFileId = org.avatarFileId;
      await ctx.db.delete(org._id);
      if (avatarFileId) {
        await deleteStorageIfUnreferenced(ctx, avatarFileId);
      }
      return { progressed: true, deletedOrganizationId: org._id };
    }
    return { progressed: true, deletedOrganizationId: null };
  },
});

/**
 * Deletes one page of an orphaned org's data. True while work remains; false
 * when only the org row is left for the caller to delete.
 */
async function drainOrganizationPage(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<boolean> {
  // One project at a time, marked pending so the project-deletion cascade owns
  // every project table; a second table list here would miss new domains.
  const project = await ctx.db
    .query("projects")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
  if (project) {
    if (!project.pendingDeletion) {
      await ctx.db.patch(project._id, {
        pendingDeletion: true,
        updatedAt: Date.now(),
      });
    }
    await deleteProjectWithData(ctx, project._id);
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
    await deleteFileAndStorageIfUnreferenced(ctx, file);
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
