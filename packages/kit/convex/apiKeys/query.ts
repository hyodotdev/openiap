import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

type SafeApiKey = Omit<Doc<"apiKeys">, "key"> & {
  keyPreview: string;
};

function getApiKeyPreview(key: string): string {
  const suffix = key.slice(-4);
  if (key.startsWith("openiap-kit_")) {
    return `openiap-kit_...${suffix}`;
  }
  return `...${suffix}`;
}

function toSafeApiKey({ key, ...apiKey }: Doc<"apiKeys">): SafeApiKey {
  return {
    ...apiKey,
    keyPreview: getApiKeyPreview(key),
  };
}

// Get all API keys for a project
export const listProjectApiKeys = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Get project to verify access
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    // Check organization membership
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("Not a member of this organization");
    }

    // Get all API keys for the project
    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    // Full keys are only returned by create/regenerate mutations.
    return apiKeys.map(toSafeApiKey);
  },
});

// Get active API keys count for a project
export const getActiveCount = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Get project to verify access
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    // Check organization membership
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("Not a member of this organization");
    }

    // Count active API keys
    const activeKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_project_and_active", (q) =>
        q.eq("projectId", args.projectId).eq("isActive", true),
      )
      .collect();

    return {
      total: activeKeys.length,
      valid: activeKeys.length,
      expired: 0,
    };
  },
});

// Get single API key details (for viewing/editing)
export const getById = query({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const apiKey = await ctx.db.get(args.keyId);
    if (!apiKey) {
      throw new ConvexError("API key not found");
    }

    // Get project to verify access
    const project = await ctx.db.get(apiKey.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    // Check organization membership with at least admin role for key details
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new ConvexError("Insufficient permissions to view API key details");
    }

    // Get creator info
    const creator = await ctx.db.get(apiKey.createdBy);

    return {
      ...toSafeApiKey(apiKey),
      creatorName: creator?.name || "Unknown",
      creatorEmail: creator?.email || "Unknown",
    };
  },
});
