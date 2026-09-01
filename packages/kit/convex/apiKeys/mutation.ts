import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateApiKey } from "../utils/helpers";
import { getProjectById } from "../projects/helpers";
import { apiKeyStorageFields } from "./helpers";

const apiKeyTypeValidator = v.union(
  v.literal("publishable"),
  v.literal("secret"),
);

// Create a new API key for a project
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    keyType: apiKeyTypeValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Get project to verify access
    const project = await getProjectById(ctx, args.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    // Check organization membership with at least admin role
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new ConvexError("Insufficient permissions to create API keys");
    }

    // Generate a new API key
    const apiKey = generateApiKey(args.keyType);
    const storageFields = await apiKeyStorageFields(apiKey, args.keyType);
    const now = Date.now();

    // Create the API key record
    const keyId = await ctx.db.insert("apiKeys", {
      projectId: args.projectId,
      organizationId: project.organizationId,
      ...storageFields,
      name: args.name,
      description: args.description,
      keyType: args.keyType,
      permissions: undefined,
      lastUsedAt: undefined,
      usageCount: 0,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(project._id, {
      legacyApiKeyFallbackDisabledAt: now,
      updatedAt: now,
    });

    // Return the full key only on creation
    return {
      _id: keyId,
      key: apiKey, // Full key returned only once
      name: args.name,
      keyType: args.keyType,
      createdAt: now,
    };
  },
});

// Update API key details
export const update = mutation({
  args: {
    keyId: v.id("apiKeys"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
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
    const project = await getProjectById(ctx, apiKey.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    // Check organization membership with at least admin role
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new ConvexError("Insufficient permissions to update API keys");
    }

    // Prepare update object
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.isActive !== undefined) {
      updates.isActive = args.isActive;
    }

    // Update the API key
    await ctx.db.patch(args.keyId, updates);

    return { success: true };
  },
});

// Delete an API key
export const remove = mutation({
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
    const project = await getProjectById(ctx, apiKey.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    // Check organization membership with owner or admin role
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new ConvexError("Insufficient permissions to delete API keys");
    }

    // Disable the legacy project-column fallback before deleting the row.
    // Both writes commit atomically in Convex, so deleting the final scoped
    // key can never make projects.apiKey valid again.
    const now = Date.now();
    await ctx.db.patch(project._id, {
      legacyApiKeyFallbackDisabledAt:
        project.legacyApiKeyFallbackDisabledAt ?? now,
      updatedAt: now,
    });
    await ctx.db.delete(args.keyId);

    return { success: true };
  },
});

// Revoke (deactivate) an API key
export const revoke = mutation({
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
    const project = await getProjectById(ctx, apiKey.projectId);
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

    if (!membership || membership.role === "member") {
      throw new ConvexError("Insufficient permissions to revoke API keys");
    }

    // Deactivate the API key
    await ctx.db.patch(args.keyId, {
      isActive: false,
      updatedAt: Date.now(),
    });
    if (project.legacyApiKeyFallbackDisabledAt === undefined) {
      await ctx.db.patch(project._id, {
        legacyApiKeyFallbackDisabledAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Regenerate an API key (creates a new key and deactivates the old one)
export const regenerate = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const oldApiKey = await ctx.db.get(args.keyId);
    if (!oldApiKey) {
      throw new ConvexError("API key not found");
    }

    // Get project to verify access
    const project = await getProjectById(ctx, oldApiKey.projectId);
    if (!project) {
      throw new ConvexError("Project not found");
    }

    // Check organization membership with at least admin role
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new ConvexError("Insufficient permissions to regenerate API keys");
    }

    // Generate a new API key
    // Unclassified legacy keys are app-facing credentials and regenerate into
    // explicitly publishable keys instead of silently retaining admin access.
    const keyType = oldApiKey.keyType ?? "publishable";
    const newApiKey = generateApiKey(keyType);
    const storageFields = await apiKeyStorageFields(newApiKey, keyType);
    const now = Date.now();
    if (project.legacyApiKeyFallbackDisabledAt === undefined) {
      await ctx.db.patch(project._id, {
        legacyApiKeyFallbackDisabledAt: now,
        updatedAt: now,
      });
    }

    // Deactivate the old key
    await ctx.db.patch(args.keyId, {
      isActive: false,
      updatedAt: now,
    });

    // Create the new API key with same settings
    const newKeyId = await ctx.db.insert("apiKeys", {
      projectId: oldApiKey.projectId,
      organizationId: oldApiKey.organizationId,
      ...storageFields,
      name: `${oldApiKey.name} (Regenerated)`,
      description: oldApiKey.description,
      keyType,
      permissions: oldApiKey.permissions,
      lastUsedAt: undefined,
      usageCount: 0,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Return the new key
    return {
      _id: newKeyId,
      key: newApiKey, // Full key returned only once
      name: `${oldApiKey.name} (Regenerated)`,
      keyType,
      createdAt: now,
    };
  },
});
