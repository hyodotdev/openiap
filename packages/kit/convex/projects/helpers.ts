import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import {
  allowsLegacyProjectApiKeyFallback,
  assertApiKeyAccess,
  effectiveApiKeyType,
  getApiKeyByKey,
  type ApiKeyAccess,
  type ApiKeyType,
} from "../apiKeys/helpers";
import { deleteFileAndStorageIfUnreferenced } from "../files/storage";
export {
  getWritableOrganization as getOrganizationById,
  getWritableProject as getProjectById,
} from "./writable";

export type ApiKeyProjectResolution = {
  project: Doc<"projects">;
  keyId?: Id<"apiKeys">;
  keyType: ApiKeyType;
  organizationId: Id<"organizations">;
};

// A project-scoped row can be close to Convex's 1 MiB document limit (raw
// signed webhook payloads, file metadata, product sync results, or app-owned
// payload bodies). Keep each transaction comfortably below the 16 MiB read
// limit even when every row in the page is maximally large.
const PROJECT_DELETION_PAGE = 10;

async function scheduleProjectDeletionContinuation(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<void> {
  await ctx.scheduler.runAfter(
    0,
    internal.projects.internal.continueProjectDeletion,
    { projectId },
  );
}

export async function resolveProjectByApiKeyFromDb(
  ctx: QueryCtx | MutationCtx,
  apiKey: string,
  requiredAccess: ApiKeyAccess = "client",
): Promise<ApiKeyProjectResolution | null> {
  const keyRow = await getApiKeyByKey(ctx, apiKey);
  if (keyRow !== null) {
    if (keyRow.isActive === false) return null;
    const project = await ctx.db.get(keyRow.projectId);
    if (!project || project.pendingDeletion) return null;
    const organization = await ctx.db.get(project.organizationId);
    if (!organization || organization.pendingDeletion) return null;
    const keyType = effectiveApiKeyType(keyRow.keyType);
    assertApiKeyAccess(keyType, requiredAccess);
    return {
      project,
      keyId: keyRow._id,
      keyType,
      organizationId: keyRow.organizationId,
    };
  }

  const legacyProject = await ctx.db
    .query("projects")
    .withIndex("by_api_key", (q) => q.eq("apiKey", apiKey))
    .first();

  if (!legacyProject || legacyProject.pendingDeletion) return null;
  if (!(await allowsLegacyProjectApiKeyFallback(ctx, legacyProject))) {
    return null;
  }
  const organization = await ctx.db.get(legacyProject.organizationId);
  if (!organization || organization.pendingDeletion) return null;
  // The legacy project column was the value the old documentation told apps
  // to embed. Never grant it newly separated administrative capabilities.
  const keyType = "publishable";
  assertApiKeyAccess(keyType, requiredAccess);
  return {
    project: legacyProject,
    keyType,
    organizationId: legacyProject.organizationId,
  };
}

// Signed JWS, purchase tokens, receipts and store responses can be replayed
// against verify and bind, so only project admins and owners read them.
export function canReadRawStoreEvidence(
  role: "owner" | "admin" | "member",
): boolean {
  return role === "owner" || role === "admin";
}

export async function resolveProjectByIdForCurrentUserFromDb(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
): Promise<{
  project: Doc<"projects">;
  userId: Id<"users">;
  role: "owner" | "admin" | "member";
} | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const project = await ctx.db.get(projectId);
  if (!project || project.pendingDeletion) return null;
  const organization = await ctx.db.get(project.organizationId);
  if (!organization || organization.pendingDeletion) return null;

  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("organizationId", project.organizationId).eq("userId", userId),
    )
    .first();

  return membership ? { project, userId, role: membership.role } : null;
}

export type OperatorProjectArgs = {
  projectId?: Id<"projects">;
  apiKey?: string;
};

/**
 * Project for an operations read or write: a secret admin key, or a dashboard
 * session where any member reads and only owners and admins write.
 */
export async function resolveOperatorProject(
  ctx: QueryCtx | MutationCtx,
  args: OperatorProjectArgs,
  access: "read" | "write",
): Promise<Doc<"projects">> {
  return (await resolveOperatorAccess(ctx, args, access)).project;
}

/**
 * `resolveOperatorProject`, plus `adminView`: a secret key, owner or admin,
 * who may see raw store identifiers and receiver errors.
 */
export async function resolveOperatorAccess(
  ctx: QueryCtx | MutationCtx,
  args: OperatorProjectArgs,
  access: "read" | "write",
): Promise<{ project: Doc<"projects">; adminView: boolean }> {
  if (args.apiKey !== undefined) {
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    if (!resolved) {
      throw new ConvexError({
        code: "INVALID_API_KEY",
        message: "API key is invalid or inactive",
      });
    }
    return { project: resolved.project, adminView: true };
  }
  if (!args.projectId) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "apiKey or projectId is required",
    });
  }
  const resolved = await resolveProjectByIdForCurrentUserFromDb(
    ctx,
    args.projectId,
  );
  if (!resolved) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found" });
  }
  if (access === "write" && resolved.role === "member") {
    throw new ConvexError({
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only organization owners and admins can do this",
    });
  }
  return {
    project: resolved.project,
    adminView: canReadRawStoreEvidence(resolved.role),
  };
}

/**
 * Delete a project and all of its Convex data (API keys, receipts, files).
 * Keeps the cascade logic in one place so both direct and indirect callers stay in sync.
 */
export async function deleteProjectWithData(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<boolean> {
  const project = await ctx.db.get(projectId);
  if (!project) return true;

  // Drain exactly one non-empty table page per transaction. Several project
  // documents (payload bodies, raw webhook JWS, product/job results) can be
  // large, so even sub-100-row pages from many tables must not accumulate in
  // one mutation. Every page schedules the next step; the cron is recovery.
  const productClientPayloads = await ctx.db
    .query("productClientPayloads")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const payload of productClientPayloads) {
    await ctx.db.delete(payload._id);
  }
  if (productClientPayloads.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const productClientPayloadSummaries = await ctx.db
    .query("productClientPayloadSummaries")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const summary of productClientPayloadSummaries) {
    await ctx.db.delete(summary._id);
  }
  if (productClientPayloadSummaries.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const productClientPayloadDrafts = await ctx.db
    .query("productClientPayloadDrafts")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const draft of productClientPayloadDrafts) {
    await ctx.db.delete(draft._id);
  }
  if (productClientPayloadDrafts.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const productClientPayloadVersions = await ctx.db
    .query("productClientPayloadVersions")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const version of productClientPayloadVersions) {
    await ctx.db.delete(version._id);
  }
  if (productClientPayloadVersions.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const apiKeys = await ctx.db
    .query("apiKeys")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const apiKey of apiKeys) {
    await ctx.db.delete(apiKey._id);
  }
  if (apiKeys.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const purchases = await ctx.db
    .query("purchases")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const purchase of purchases) {
    await ctx.db.delete(purchase._id);
  }
  if (purchases.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const purchaseIssues = await ctx.db
    .query("purchaseIssues")
    .withIndex("by_project_and_lastSeenAt", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const issue of purchaseIssues) {
    await ctx.db.delete(issue._id);
  }
  if (purchaseIssues.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const files = await ctx.db
    .query("files")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const file of files) {
    await deleteFileAndStorageIfUnreferenced(ctx, file);
  }
  if (files.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const outboundDeliveryQueues = await ctx.db
    .query("outboundDeliveryQueues")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const queue of outboundDeliveryQueues) {
    await ctx.db.delete(queue._id);
  }
  if (outboundDeliveryQueues.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const outboundDeliveries = await ctx.db
    .query("outboundDeliveries")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const delivery of outboundDeliveries) {
    await ctx.db.delete(delivery._id);
  }
  if (outboundDeliveries.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const outboundDestinations = await ctx.db
    .query("outboundDestinations")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const destination of outboundDestinations) {
    await ctx.db.delete(destination._id);
  }
  if (outboundDestinations.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const commerceEvents = await ctx.db
    .query("commerceEvents")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const event of commerceEvents) {
    await ctx.db.delete(event._id);
  }
  if (commerceEvents.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const webhookEvents = await ctx.db
    .query("webhookEvents")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const event of webhookEvents) {
    await ctx.db.delete(event._id);
  }
  if (webhookEvents.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const subscriptionUserErasureJobs = await ctx.db
    .query("subscriptionUserErasureJobs")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const job of subscriptionUserErasureJobs) {
    await ctx.db.delete(job._id);
  }
  if (subscriptionUserErasureJobs.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const subscriptionTokenAliases = await ctx.db
    .query("subscriptionTokenAliases")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const alias of subscriptionTokenAliases) {
    await ctx.db.delete(alias._id);
  }
  if (subscriptionTokenAliases.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const subscription of subscriptions) {
    await ctx.db.delete(subscription._id);
  }
  if (subscriptions.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const subscriptionStats = await ctx.db
    .query("subscriptionStats")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const stats of subscriptionStats) {
    await ctx.db.delete(stats._id);
  }
  if (subscriptionStats.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const subscriptionStatsRebuilds = await ctx.db
    .query("subscriptionStatsRebuilds")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const rebuild of subscriptionStatsRebuilds) {
    await ctx.db.delete(rebuild._id);
  }
  if (subscriptionStatsRebuilds.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const revenueMetricsDaily = await ctx.db
    .query("revenueMetricsDaily")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const metrics of revenueMetricsDaily) {
    await ctx.db.delete(metrics._id);
  }
  if (revenueMetricsDaily.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const revenueMetricsRunStatus = await ctx.db
    .query("revenueMetricsRunStatus")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const status of revenueMetricsRunStatus) {
    await ctx.db.delete(status._id);
  }
  if (revenueMetricsRunStatus.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const revenueCohorts = await ctx.db
    .query("revenueCohortsMonthly")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const cohort of revenueCohorts) {
    await ctx.db.delete(cohort._id);
  }
  if (revenueCohorts.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const products = await ctx.db
    .query("products")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const product of products) {
    await ctx.db.delete(product._id);
  }
  if (products.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const productSyncJobs = await ctx.db
    .query("productSyncJobs")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const job of productSyncJobs) {
    await ctx.db.delete(job._id);
  }
  if (productSyncJobs.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const purchaseStats = await ctx.db
    .query("purchaseStats")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const stats of purchaseStats) {
    await ctx.db.delete(stats._id);
  }
  if (purchaseStats.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  const admissionBuckets = await ctx.db
    .query("verificationAdmissionBuckets")
    .withIndex("by_project_and_bucket", (q) => q.eq("projectId", projectId))
    .take(PROJECT_DELETION_PAGE);
  for (const bucket of admissionBuckets) {
    await ctx.db.delete(bucket._id);
  }
  if (admissionBuckets.length > 0) {
    await scheduleProjectDeletionContinuation(ctx, projectId);
    return false;
  }

  await ctx.db.delete(projectId);
  return true;
}
