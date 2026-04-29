import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const saveFile = mutation({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    purpose: v.union(
      v.literal("apple_p8_key"),
      v.literal("android_service_account"),
    ),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    isInternal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Verify user has access to organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("Not a member of this organization");
    }

    // Verify project belongs to organization if provided
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.organizationId !== args.organizationId) {
        throw new ConvexError("Invalid project");
      }
    }

    const now = Date.now();

    const fileId = await ctx.db.insert("files", {
      organizationId: args.organizationId,
      projectId: args.projectId,
      uploadedBy: userId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      purpose: args.purpose,
      description: args.description,
      metadata: args.metadata,
      isInternal: args.isInternal ?? true,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Return only safe metadata, never the storageId
    return {
      _id: fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      purpose: args.purpose,
      createdAt: now,
    };
  },
});

export const remove = mutation({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new ConvexError("File not found");
    }

    // Verify user has admin access to organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", file.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new ConvexError("Insufficient permissions");
    }

    // Delete the file from storage
    await ctx.storage.delete(file.storageId);

    // Delete the file record
    await ctx.db.delete(args.fileId);

    return { success: true };
  },
});

export const updateMetadata = mutation({
  args: {
    fileId: v.id("files"),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const file = await ctx.db.get(args.fileId);
    if (!file) {
      throw new ConvexError("File not found");
    }

    // Verify user has access to organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", file.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      throw new ConvexError("Not a member of this organization");
    }

    const updates: any = {
      updatedAt: Date.now(),
    };

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.metadata !== undefined) {
      updates.metadata = args.metadata;
    }

    await ctx.db.patch(args.fileId, updates);

    return { success: true };
  },
});

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // Generate and return the upload URL
    return await ctx.storage.generateUploadUrl();
  },
});
