import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getApiKeyByKey } from "../apiKeys/helpers";
import { deletePurchaseStatsForProject } from "../purchases/stats";

export type ApiKeyProjectResolution = {
  project: Doc<"projects">;
  keyId?: Id<"apiKeys">;
  organizationId: Id<"organizations">;
};

export async function resolveProjectByApiKeyFromDb(
  ctx: QueryCtx | MutationCtx,
  apiKey: string,
): Promise<ApiKeyProjectResolution | null> {
  const keyRow = await getApiKeyByKey(ctx, apiKey);
  if (keyRow !== null) {
    if (keyRow.isActive === false) return null;
    const project = await ctx.db.get(keyRow.projectId);
    if (!project) return null;
    return {
      project,
      keyId: keyRow._id,
      organizationId: keyRow.organizationId,
    };
  }

  const legacyProject = await ctx.db
    .query("projects")
    .withIndex("by_api_key", (q) => q.eq("apiKey", apiKey))
    .first();

  if (!legacyProject) return null;
  return {
    project: legacyProject,
    organizationId: legacyProject.organizationId,
  };
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
  if (!project) return null;

  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("organizationId", project.organizationId).eq("userId", userId),
    )
    .first();

  return membership ? { project, userId, role: membership.role } : null;
}

/**
 * Delete a project and all of its Convex data (API keys, receipts, files).
 * Keeps the cascade logic in one place so both direct and indirect callers stay in sync.
 */
export async function deleteProjectWithData(
  ctx: MutationCtx,
  projectId: Id<"projects">,
) {
  const apiKeys = await ctx.db
    .query("apiKeys")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  for (const apiKey of apiKeys) {
    await ctx.db.delete(apiKey._id);
  }

  const purchases = await ctx.db
    .query("purchases")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  for (const purchase of purchases) {
    await ctx.db.delete(purchase._id);
  }

  const files = await ctx.db
    .query("files")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  for (const file of files) {
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
  }

  await deletePurchaseStatsForProject(ctx, projectId);

  await ctx.db.delete(projectId);
}

export function getProjectById(ctx: QueryCtx, id: Id<"projects">) {
  return ctx.db.get(id);
}
