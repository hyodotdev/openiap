import { createError, ErrorCode } from "../utils/errors";
import { assertCliScope } from "../cli/scope";
import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getWritableProject } from "../projects/writable";
import { apiKeyPreview } from "./helpers";

type SafeApiKey = Omit<Doc<"apiKeys">, "key" | "keyHash" | "keyPreview"> & {
  keyPreview: string;
};

function toSafeApiKey({
  key,
  keyHash: _keyHash,
  keyPreview,
  ...apiKey
}: Doc<"apiKeys">): SafeApiKey {
  return {
    ...apiKey,
    keyPreview: keyPreview ?? (key ? apiKeyPreview(key) : "unavailable"),
  };
}

// Get all API keys for a project
export const listProjectApiKeys = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED, "Not authenticated");
    }

    // Get project to verify access
    const project = await getWritableProject(ctx, args.projectId);
    if (!project) {
      throw createError(ErrorCode.PROJECT_NOT_FOUND, "Project not found");
    }

    // Check organization membership
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw createError(
        ErrorCode.NOT_ORGANIZATION_MEMBER,
        "Not a member of this organization",
      );
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
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED, "Not authenticated");
    }

    // Get project to verify access
    const project = await getWritableProject(ctx, args.projectId);
    if (!project) {
      throw createError(ErrorCode.PROJECT_NOT_FOUND, "Project not found");
    }

    // Check organization membership
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw createError(
        ErrorCode.NOT_ORGANIZATION_MEMBER,
        "Not a member of this organization",
      );
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
    await assertCliScope(ctx, "read");
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw createError(ErrorCode.NOT_AUTHENTICATED, "Not authenticated");
    }

    const apiKey = await ctx.db.get(args.keyId);
    if (!apiKey) {
      throw createError(ErrorCode.API_KEY_NOT_FOUND, "API key not found");
    }

    // Get project to verify access
    const project = await getWritableProject(ctx, apiKey.projectId);
    if (!project) {
      throw createError(ErrorCode.PROJECT_NOT_FOUND, "Project not found");
    }

    // Check organization membership with at least admin role for key details
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership || membership.role === "member") {
      throw createError(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        "Insufficient permissions to view API key details",
      );
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
