import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { assertCliScope } from "../cli/scope";
import {
  MAX_GRANTS_PER_PROJECT,
  USE_RECORD_INTERVAL_MS,
  adminProject,
  assertOauthServer,
  grantByAccessToken,
  oauthServerProofValidator,
} from "./grants";
import {
  BROWSER_ONLY,
  authorizationRequestValidator,
  checkAuthorizationRequest,
  isCliIdentity,
} from "./request";

/** What the consent page shows: the app asking, and the projects it may get. */
export const authorizationRequest = query({
  args: { request: authorizationRequestValidator },
  handler: async (ctx, { request }) => {
    const checked = checkAuthorizationRequest(request);
    if (!checked.ok) return { error: checked.error };
    if (await isCliIdentity(ctx)) return { error: BROWSER_ONLY };
    const userId = await getAuthUserId(ctx);
    if (!userId) return { error: "Sign in to IAPKit first." };

    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const projects = [];
    for (const membership of memberships) {
      if (membership.role === "member") continue;
      const organization = await ctx.db.get(membership.organizationId);
      if (!organization || organization.pendingDeletion) continue;
      const rows = await ctx.db
        .query("projects")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", membership.organizationId),
        )
        .collect();
      for (const project of rows) {
        if (project.pendingDeletion) continue;
        projects.push({
          id: project._id,
          name: project.name,
          organizationName: organization.name,
        });
      }
    }
    return {
      clientName: checked.clientName,
      redirectHost: new URL(checked.redirectUri).host,
      projects,
    };
  },
});

/** Connectors that can reach a project, for its owners and admins. */
export const listProjectGrants = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    // Null hides the card from members, who cannot see or end grants.
    if (!userId || !(await adminProject(ctx, userId, projectId))) return null;
    const grants = await ctx.db
      .query("oauthGrants")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(MAX_GRANTS_PER_PROJECT);
    return Promise.all(
      grants.map(async (grant) => ({
        id: grant._id,
        clientName: grant.clientName,
        scope: grant.scope,
        connectedBy: (await ctx.db.get(grant.userId))?.name ?? null,
        createdAt: grant.createdAt,
        lastUsedAt: grant.lastUsedAt,
      })),
    );
  },
});

/**
 * Resolves an access token for the hosted MCP server. The result names the
 * grant but carries no credential: the server derives that itself.
 */
export const authenticate = query({
  args: { server: oauthServerProofValidator, accessToken: v.string() },
  handler: async (ctx, { server, accessToken }) => {
    const now = await assertOauthServer(server);
    const grant = await grantByAccessToken(ctx, accessToken);
    if (
      !grant ||
      grant.accessExpiresAt <= now ||
      !(await adminProject(ctx, grant.userId, grant.projectId))
    )
      return null;
    return {
      grantId: grant._id,
      projectId: grant.projectId,
      scope: grant.scope,
      // The server then calls `markUsed`; a query cannot write.
      recordUse: now - grant.lastUsedAt >= USE_RECORD_INTERVAL_MS,
    };
  },
});
