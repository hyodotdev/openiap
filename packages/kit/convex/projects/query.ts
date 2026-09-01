import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc } from "../_generated/dataModel";

import {
  allowsLegacyProjectApiKeyFallback,
  effectiveApiKeyType,
} from "../apiKeys/helpers";
import { resolveProjectByIdForCurrentUserFromDb } from "./helpers";

function projectWithSecretState(project: Doc<"projects">): Omit<
  Doc<"projects">,
  "horizonAppSecret" | "amazonSharedSecret"
> & {
  hasHorizonAppSecret: boolean;
  hasAmazonSharedSecret: boolean;
} {
  const { horizonAppSecret, amazonSharedSecret, ...rest } = project;
  return {
    ...rest,
    hasHorizonAppSecret:
      typeof horizonAppSecret === "string" && horizonAppSecret.length > 0,
    hasAmazonSharedSecret:
      typeof amazonSharedSecret === "string" && amazonSharedSecret.length > 0,
  };
}

function projectForApiKeyLookup(project: Doc<"projects">): Omit<
  Doc<"projects">,
  "apiKey" | "horizonAppSecret" | "amazonSharedSecret"
> & {
  hasHorizonAppSecret: boolean;
  hasAmazonSharedSecret: boolean;
} {
  const { apiKey, ...rest } = projectWithSecretState(project);
  void apiKey;
  return rest;
}

function projectForDashboard(project: Doc<"projects">): Omit<
  Doc<"projects">,
  "apiKey" | "horizonAppSecret" | "amazonSharedSecret"
> & {
  hasHorizonAppSecret: boolean;
  hasAmazonSharedSecret: boolean;
} {
  return projectForApiKeyLookup(project);
}

function projectForList(
  project: Doc<"projects">,
  projectIdsWithAnyKey: Set<string>,
  projectIdsWithActiveKey: Set<string>,
): Omit<
  Doc<"projects">,
  "apiKey" | "horizonAppSecret" | "amazonSharedSecret"
> & {
  hasApiKey: boolean;
  hasHorizonAppSecret: boolean;
  hasAmazonSharedSecret: boolean;
} {
  const { apiKey, ...rest } = projectWithSecretState(project);
  return {
    ...rest,
    // Legacy-only projects predate the apiKeys table, so fall back to
    // projects.apiKey only when no apiKeys rows exist yet. Once a project has
    // entered the key table, active/revoked state there is authoritative.
    hasApiKey:
      projectIdsWithActiveKey.has(project._id) ||
      (!projectIdsWithAnyKey.has(project._id) && apiKey.length > 0),
  };
}

export const listOrganizationProjects = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const organization = await ctx.db.get(args.organizationId);
    if (!organization || organization.pendingDeletion) return [];

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

    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    const projectIdsWithAnyKey = new Set(
      apiKeys.map((apiKey) => apiKey.projectId),
    );
    const projectIdsWithActiveKey = new Set(
      apiKeys
        .filter((apiKey) => apiKey.isActive)
        .map((apiKey) => apiKey.projectId),
    );

    return projects
      .filter((project) => !project.pendingDeletion)
      .map((project) =>
        projectForList(project, projectIdsWithAnyKey, projectIdsWithActiveKey),
      );
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
    const organization = await ctx.db.get(args.organizationId);
    if (!organization || organization.pendingDeletion) return null;

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

    return project && !project.pendingDeletion
      ? projectForDashboard(project)
      : null;
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
    if (!project || project.pendingDeletion) {
      return null;
    }
    const organization = await ctx.db.get(project.organizationId);
    if (!organization || organization.pendingDeletion) return null;

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

    return projectForDashboard(project);
  },
});

export function selectActiveWebhookPublishableKey(
  apiKeys: Array<
    Pick<Doc<"apiKeys">, "createdAt" | "isActive" | "key" | "keyType">
  >,
): string | undefined {
  const activeApiKeys = apiKeys
    .filter((apiKey) => apiKey.isActive)
    .sort((a, b) => b.createdAt - a.createdAt);
  return activeApiKeys.find(
    (apiKey) =>
      effectiveApiKeyType(apiKey.keyType) === "publishable" &&
      typeof apiKey.key === "string",
  )?.key;
}

async function getWebhookApiKey(ctx: QueryCtx, project: Doc<"projects">) {
  const apiKeys = await ctx.db
    .query("apiKeys")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .collect();
  const selected = selectActiveWebhookPublishableKey(apiKeys);
  if (selected) return selected;

  // Legacy-only projects predate the apiKeys table. Reuse the central fallback
  // policy so revoking or deleting the final scoped key cannot make the
  // deprecated projects.apiKey appear usable in the dashboard again.
  const mayUseLegacyFallback = await allowsLegacyProjectApiKeyFallback(
    ctx,
    project,
  );
  return mayUseLegacyFallback && project.apiKey.length > 0
    ? project.apiKey
    : undefined;
}

function lifecycleWebhookPathsForApiKey(apiKey: string) {
  const encodedApiKey = encodeURIComponent(apiKey);
  return {
    unified: `/v1/webhooks/${encodedApiKey}`,
    apple: `/v1/webhooks/apple/${encodedApiKey}`,
    google: `/v1/webhooks/google/${encodedApiKey}`,
  };
}

export const getWebhookEndpointPaths = query({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.null(),
    v.object({
      unified: v.string(),
      apple: v.string(),
      google: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByIdForCurrentUserFromDb(
      ctx,
      args.projectId,
    );
    if (!resolved) return null;
    if (resolved.role === "member") return null;

    const publishableKey = await getWebhookApiKey(ctx, resolved.project);
    return publishableKey
      ? lifecycleWebhookPathsForApiKey(publishableKey)
      : null;
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
    const organization = await ctx.db.get(organizationId);
    if (!organization || organization.pendingDeletion) return false;

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
      .filter((q) => q.neq(q.field("pendingDeletion"), true))
      .first();

    return project !== null;
  },
});
