import { query } from "../_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// List files - returns only metadata, NEVER storageId or URLs
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    purpose: v.optional(
      v.union(
        v.literal("apple_p8_key"),
        v.literal("apple_p8_asc_api_key"),
        v.literal("android_service_account"),
      ),
    ),
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

    // Build query
    const filesQuery = ctx.db
      .query("files")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    const files = await filesQuery.collect();

    // Filter by project if specified
    let filteredFiles = files;
    if (args.projectId) {
      filteredFiles = files.filter((f) => f.projectId === args.projectId);
    }

    // Filter by purpose if specified
    if (args.purpose) {
      filteredFiles = filteredFiles.filter((f) => f.purpose === args.purpose);
    }

    // Get uploader information
    const uploaderIds = [...new Set(filteredFiles.map((f) => f.uploadedBy))];

    // Get user profiles for display names
    const userProfiles = await Promise.all(
      uploaderIds.map((userId) =>
        ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .first(),
      ),
    );

    const profileMap = new Map(userProfiles.map((p) => [p?.userId, p]));

    // Return safe metadata only - NEVER expose storageId
    return filteredFiles.map((file) => ({
      _id: file._id,
      organizationId: file.organizationId,
      projectId: file.projectId,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      purpose: file.purpose,
      description: file.description,
      isInternal: file.isInternal,
      uploadedBy: {
        userId: file.uploadedBy,
        displayName: profileMap.get(file.uploadedBy)?.displayName || "Unknown",
      },
      lastAccessedAt: file.lastAccessedAt,
      accessCount: file.accessCount,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }));
  },
});

// Get single file metadata
export const get = query({
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
      return null;
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

    // Get uploader profile
    const uploaderProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", file.uploadedBy))
      .first();

    // Return safe metadata only - NEVER expose storageId
    return {
      _id: file._id,
      organizationId: file.organizationId,
      projectId: file.projectId,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      purpose: file.purpose,
      description: file.description,
      metadata: file.metadata,
      isInternal: file.isInternal,
      uploadedBy: {
        userId: file.uploadedBy,
        displayName: uploaderProfile?.displayName || "Unknown",
      },
      lastAccessedAt: file.lastAccessedAt,
      accessCount: file.accessCount,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  },
});

// Count files by organization
export const count = query({
  args: {
    organizationId: v.id("organizations"),
    purpose: v.optional(
      v.union(
        v.literal("apple_p8_key"),
        v.literal("apple_p8_asc_api_key"),
        v.literal("android_service_account"),
      ),
    ),
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

    const files = await ctx.db
      .query("files")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    if (args.purpose) {
      return files.filter((f) => f.purpose === args.purpose).length;
    }

    return files.length;
  },
});

// Get App Store file by project
export const getAppStoreFileByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Get project to verify access
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Verify user has access to organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      return null;
    }

    // Find App Store file for this project via the by_project index.
    // Prior `by_organization + filter in memory` returned every file
    // across every project in the org, which scaled with the org's
    // total file count rather than just the target project's.
    const projectFiles = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const appStoreFile = projectFiles.find((f) => f.purpose === "apple_p8_key");

    if (!appStoreFile) {
      return null;
    }

    // Return safe metadata only
    return {
      _id: appStoreFile._id,
      fileName: appStoreFile.fileName,
      fileSize: appStoreFile.fileSize,
      uploadedAt: appStoreFile.createdAt,
    };
  },
});

// Get the App Store Connect API key (.p8) by project. Genuinely a
// different file from `getAppStoreFileByProject` — see schema.ts.
// Used by `products/asc.ts` for push-sync.
export const getAscApiKeyFileByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();
    if (!membership) {
      return null;
    }
    const projectFiles = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const ascFile = projectFiles.find(
      (f) => f.purpose === "apple_p8_asc_api_key",
    );
    if (!ascFile) {
      return null;
    }
    return {
      _id: ascFile._id,
      fileName: ascFile.fileName,
      fileSize: ascFile.fileSize,
      uploadedAt: ascFile.createdAt,
    };
  },
});

// Get Google Play file by project
export const getGooglePlayFileByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Get project to verify access
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Verify user has access to organization
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      return null;
    }

    // Find Google Play file for this project via the by_project index
    // (see appStore counterpart above for why).
    const projectFiles = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const googlePlayFile = projectFiles.find(
      (f) => f.purpose === "android_service_account",
    );

    if (!googlePlayFile) {
      return null;
    }

    // Return safe metadata only
    return {
      _id: googlePlayFile._id,
      fileName: googlePlayFile.fileName,
      fileSize: googlePlayFile.fileSize,
      uploadedAt: googlePlayFile.createdAt,
    };
  },
});
