import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { deletePurchaseStatsForProject } from "../purchases/stats";

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
