import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DatabaseCtx = QueryCtx | MutationCtx;

/** Return an organization only while new project-owned writes are allowed. */
export async function getWritableOrganization(
  ctx: DatabaseCtx,
  id: Id<"organizations">,
): Promise<Doc<"organizations"> | null> {
  const organization = await ctx.db.get(id);
  return !organization || organization.pendingDeletion ? null : organization;
}

/**
 * Return a project only while both it and its owning organization accept
 * writes. Actions must call this again in their final mutation: resolving an
 * API key before an external store request is not enough because deletion can
 * begin while that request is in flight.
 */
export async function getWritableProject(
  ctx: DatabaseCtx,
  id: Id<"projects">,
): Promise<Doc<"projects"> | null> {
  const project = await ctx.db.get(id);
  if (!project || project.pendingDeletion) return null;
  const organization = await getWritableOrganization(
    ctx,
    project.organizationId,
  );
  return organization ? project : null;
}

export async function assertProjectWritable(
  ctx: DatabaseCtx,
  id: Id<"projects">,
): Promise<Doc<"projects">> {
  const project = await getWritableProject(ctx, id);
  if (!project) throw new ConvexError("Project not found");
  return project;
}
