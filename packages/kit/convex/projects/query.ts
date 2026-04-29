import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "../_generated/dataModel";

/**
 * Strip long-lived server-side secrets from a project document before
 * returning it to the client. The Horizon App Secret is used by the
 * IAPKit server to compose `OC|APP_ID|APP_SECRET` for Meta's Graph
 * API; reading it back into the dashboard would let any org member
 * exfiltrate it through the browser. Apple `.p8` and Google service
 * accounts live in the `files` table and were already safe — Horizon
 * was the only credential stored inline on `projects`, so only it
 * needs redaction here.
 *
 * The client still needs to know whether a secret is configured so
 * the UI can show "Replace" vs. "Enter secret"; expose that as a
 * derived boolean instead.
 */
function redactProjectSecrets(project: Doc<"projects">): Omit<
  Doc<"projects">,
  "horizonAppSecret"
> & {
  hasHorizonAppSecret: boolean;
} {
  const { horizonAppSecret, ...rest } = project;
  return {
    ...rest,
    hasHorizonAppSecret:
      typeof horizonAppSecret === "string" && horizonAppSecret.length > 0,
  };
}

export const listOrganizationProjects = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Check if user has access to this organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      return [];
    }

    // Get all projects for the organization
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return projects.map(redactProjectSecrets);
  },
});

export const getProject = query({
  args: {
    organizationId: v.id("organizations"),
    projectSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Check if user has access to this organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      return null;
    }

    // Get project by org and slug
    const project = await ctx.db
      .query("projects")
      .withIndex("by_org_and_slug", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("slug", args.projectSlug),
      )
      .first();

    return project ? redactProjectSecrets(project) : null;
  },
});

// Alias for compatibility
export const getProjectByOrgAndSlug = getProject;

export const getProjectById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Check if user has access to the project's organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      return null;
    }

    return redactProjectSecrets(project);
  },
});

export const hasProjects = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    // Get user profile to find current organization
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || !profile.currentOrganizationId) {
      return false;
    }

    const organizationId = profile.currentOrganizationId;

    // Check if user has access to this organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      return false;
    }

    // Check if organization has any projects
    const project = await ctx.db
      .query("projects")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .first();

    return project !== null;
  },
});

// Public query to find project by API key (used by API verification endpoints).
// Uses the `by_api_key` index on `projects` so this is a single point lookup
// instead of a table scan.
export const getProjectByApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .first();
  },
});
