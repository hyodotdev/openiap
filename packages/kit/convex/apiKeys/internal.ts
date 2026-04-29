import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// Internal query to validate an API key and get the associated project
export const validateApiKey = internalQuery({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // First check if it's a legacy API key in the projects table
    const projectWithLegacyKey = await ctx.db
      .query("projects")
      .withIndex("by_api_key", (q) => q.eq("apiKey", args.apiKey))
      .first();

    if (projectWithLegacyKey) {
      // Legacy key found, return project
      return {
        isValid: true,
        projectId: projectWithLegacyKey._id,
        organizationId: projectWithLegacyKey.organizationId,
        keyId: undefined, // No keyId for legacy keys
      };
    }

    // Check the new apiKeys table
    const apiKeyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.apiKey))
      .first();

    if (!apiKeyRecord) {
      return { isValid: false };
    }

    // Check if the key is active
    if (!apiKeyRecord.isActive) {
      return { isValid: false, reason: "API key is inactive" };
    }

    // Get the project
    const project = await ctx.db.get(apiKeyRecord.projectId);
    if (!project) {
      return { isValid: false, reason: "Associated project not found" };
    }

    return {
      isValid: true,
      projectId: apiKeyRecord.projectId,
      organizationId: apiKeyRecord.organizationId,
      keyId: apiKeyRecord._id,
    };
  },
});

// Internal mutation to update API key usage statistics
export const updateUsageStats = internalMutation({
  args: {
    keyId: v.optional(v.id("apiKeys")), // Optional because legacy keys don't have IDs
    apiKey: v.optional(v.string()), // For legacy keys
  },
  handler: async (ctx, args) => {
    if (args.keyId) {
      // Update usage stats for new API key
      const apiKey = await ctx.db.get(args.keyId);
      if (!apiKey) {
        return;
      }

      await ctx.db.patch(args.keyId, {
        lastUsedAt: Date.now(),
        usageCount: (apiKey.usageCount || 0) + 1,
        updatedAt: Date.now(),
      });
    }
    // For legacy keys, we don't track usage stats
  },
});

// Internal mutation to migrate a project from legacy API key to new system
export const migrateProjectApiKey = internalMutation({
  args: {
    projectId: v.id("projects"),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    // Check if migration already done (check for existing keys)
    const existingKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    if (existingKeys) {
      // Already migrated
      return { alreadyMigrated: true };
    }

    const now = Date.now();

    // Create a new API key record from the legacy key
    const keyId = await ctx.db.insert("apiKeys", {
      projectId: args.projectId,
      organizationId: project.organizationId,
      key: project.apiKey,
      name: "Default Production Key",
      description: "Migrated from legacy API key system",
      permissions: undefined,
      lastUsedAt: undefined,
      usageCount: 0,
      isActive: true,
      createdBy: args.createdBy,
      createdAt: project.createdAt,
      updatedAt: now,
    });

    return {
      migrated: true,
      keyId,
    };
  },
});
