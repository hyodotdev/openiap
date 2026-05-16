import {
  internalQuery,
  internalMutation,
  internalAction,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";

function describeErrorForLog(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

// Internal query to get file record
export const getFileRecord = internalQuery({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.fileId);
  },
});

// Internal mutation to update file access tracking
export const updateFileAccess = internalMutation({
  args: {
    fileId: v.id("files"),
    accessCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      lastAccessedAt: Date.now(),
      accessCount: args.accessCount,
      updatedAt: Date.now(),
    });
  },
});

// Internal action to get file content - NEVER expose to client
export const getFileContent = internalAction({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args): Promise<any> => {
    const file = await ctx.runQuery(internal.files.internal.getFileRecord, {
      fileId: args.fileId,
    });

    if (!file) {
      throw new ConvexError("File not found");
    }

    // Get the actual file content from storage
    const blob = await ctx.storage.get(file.storageId);
    if (!blob) {
      throw new ConvexError("File content not found in storage");
    }

    // Update access tracking
    // await ctx.runMutation(internal.files.internal.updateFileAccess, {
    //   fileId: args.fileId,
    //   accessCount: (file.accessCount || 0) + 1,
    // });

    return {
      file,
      blob,
    };
  },
});

// Internal action to get file by storageId
export const getFileByStorageId = internalAction({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<any> => {
    const file = await ctx.runQuery(
      internal.files.internal.getFileByStorageIdQuery,
      {
        storageId: args.storageId,
      },
    );

    if (!file) {
      throw new ConvexError("File not found");
    }

    const blob = await ctx.storage.get(file.storageId);
    if (!blob) {
      throw new ConvexError("File content not found in storage");
    }

    // Update access tracking
    // await ctx.runMutation(internal.files.internal.updateFileAccess, {
    //   fileId: file._id,
    //   accessCount: (file.accessCount || 0) + 1,
    // });

    return {
      file,
      blob,
    };
  },
});

// Internal query to get file by storageId — uses the `by_storage_id`
// index for O(log n) lookup rather than scanning the whole `files` table.
export const getFileByStorageIdQuery = internalQuery({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_storage_id", (q) => q.eq("storageId", args.storageId))
      .first();
  },
});

// Internal action to read file as text
export const readFileAsText = internalAction({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args): Promise<any> => {
    const file = await ctx.runQuery(internal.files.internal.getFileRecord, {
      fileId: args.fileId,
    });

    if (!file) {
      throw new ConvexError("File not found");
    }

    // Get the actual file content from storage
    const blob = await ctx.storage.get(file.storageId);
    if (!blob) {
      throw new ConvexError("File content not found in storage");
    }

    // Update access tracking
    // await ctx.runMutation(internal.files.internal.updateFileAccess, {
    //   fileId: args.fileId,
    //   accessCount: (file.accessCount || 0) + 1,
    // });

    // Convert blob to text using TextDecoder (works in Convex environment)
    const text = await blob.text();

    return {
      fileId: file._id,
      fileName: file.fileName,
      content: text,
      metadata: file.metadata,
    };
  },
});

// Internal action to read file as base64
export const readFileAsBase64 = internalAction({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args): Promise<any> => {
    const file = await ctx.runQuery(internal.files.internal.getFileRecord, {
      fileId: args.fileId,
    });

    if (!file) {
      throw new ConvexError("File not found");
    }

    // Get the actual file content from storage
    const blob = await ctx.storage.get(file.storageId);
    if (!blob) {
      throw new ConvexError("File content not found in storage");
    }

    // Update access tracking
    // await ctx.runMutation(internal.files.internal.updateFileAccess, {
    //   fileId: args.fileId,
    //   accessCount: (file.accessCount || 0) + 1,
    // });

    // Convex `internalAction`s without `"use node"` run in the V8
    // isolate runtime where `Buffer` is NOT a global — using it
    // throws `ReferenceError: Buffer is not defined` at request time
    // (the prior `Buffer.from(...)` shipped here was the bug behind
    // the dashboard's "download .p8" failing). Encode via `btoa` on
    // chunked binary strings so the path stays portable to either
    // runtime; chunking keeps the call-stack bound below the
    // `String.fromCharCode` argument limit for files of any size,
    // and accumulating the chunks in an array before `join("")`
    // avoids the O(n²) string-concatenation behavior of `binary +=`
    // on multi-megabyte uploads (Copilot review on PR #127).
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const CHUNK = 0x8000;
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
      chunks.push(
        String.fromCharCode.apply(
          null,
          bytes.subarray(i, i + CHUNK) as unknown as number[],
        ),
      );
    }
    const base64 = btoa(chunks.join(""));

    return {
      fileId: file._id,
      fileName: file.fileName,
      content: base64,
      metadata: file.metadata,
    };
  },
});

// Internal query to find files by purpose. The return type is the
// safe-to-export projection (no `storageId` / no `uploadedBy` —
// callers like `getAppleP8Key` must not see those). Annotated
// explicitly so callers get a strong type instead of `any[]` from
// inference through the Convex handler wrapper.
type FilePublicProjection = Omit<
  Doc<"files">,
  "storageId" | "uploadedBy" | "accessCount" | "lastAccessedAt"
>;

export const findFilesByPurpose = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    purpose: v.union(
      v.literal("apple_p8_key"),
      v.literal("apple_p8_asc_api_key"),
      v.literal("android_service_account"),
    ),
  },
  handler: async (ctx, args): Promise<FilePublicProjection[]> => {
    const files = await ctx.db
      .query("files")
      .withIndex("by_org_and_purpose", (q) =>
        q.eq("organizationId", args.organizationId).eq("purpose", args.purpose),
      )
      .collect();

    return files.map((file) => ({
      _id: file._id,
      _creationTime: file._creationTime,
      organizationId: file.organizationId,
      projectId: file.projectId,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      purpose: file.purpose,
      description: file.description,
      metadata: file.metadata,
      isInternal: file.isInternal,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }));
  },
});

// Internal query to get Google Play service account file by project.
// Uses the `by_project` index on `files` and filters by purpose through
// the query builder so we only read rows that could match — no full
// org scan into memory.
export const getGooglePlayFileByProjectInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("purpose"), "android_service_account"))
      .first();
  },
});

// Internal action to get Apple P8 key content for JWT generation
export const getAppleP8Key = internalAction({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args): Promise<any> => {
    // Find the most recent Apple P8 key file
    const files = await ctx.runQuery(
      internal.files.internal.findFilesByPurpose,
      {
        organizationId: args.organizationId,
        purpose: "apple_p8_key",
      },
    );

    // Filter by project if specified
    let targetFile = files[0];
    if (args.projectId) {
      const projectFiles = files.filter(
        (f: any) => f.projectId === args.projectId,
      );
      targetFile = projectFiles[0] || files[0];
    }

    if (!targetFile) {
      throw new ConvexError("No Apple P8 key found for this organization");
    }
    // Read the key content
    const content = await ctx.runAction(
      internal.files.internal.readFileAsText,
      {
        fileId: targetFile._id,
      },
    );

    return {
      keyContent: content.content,
      metadata: content.metadata,
      fileId: targetFile._id,
    };
  },
});

// Internal action to get the App Store Connect API key (.p8). This is
// a different key than `getAppleP8Key` returns — see schema.ts for the
// distinction. Used by `products/asc.ts` push-sync.
export const getAppleAscApiKey = internalAction({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    keyContent: string;
    metadata: unknown;
    fileId: Id<"files">;
  }> => {
    const files = await ctx.runQuery(
      internal.files.internal.findFilesByPurpose,
      {
        organizationId: args.organizationId,
        purpose: "apple_p8_asc_api_key",
      },
    );

    let targetFile = files[0];
    if (args.projectId) {
      const projectFiles = files.filter(
        (f: FilePublicProjection) => f.projectId === args.projectId,
      );
      targetFile = projectFiles[0] || files[0];
    }

    if (!targetFile) {
      throw new ConvexError(
        "No App Store Connect API key (.p8) uploaded for this project — generate one at App Store Connect → Users and Access → Integrations → App Store Connect API and upload it in Settings.",
      );
    }
    const content = await ctx.runAction(
      internal.files.internal.readFileAsText,
      {
        fileId: targetFile._id,
      },
    );

    return {
      keyContent: content.content,
      metadata: content.metadata,
      fileId: targetFile._id,
    };
  },
});

// Internal mutation to cleanup old files
export const cleanupOldFiles = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    olderThanDays: v.number(),
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - args.olderThanDays * 24 * 60 * 60 * 1000;

    const files = await ctx.db
      .query("files")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.lt(q.field("createdAt"), cutoffTime))
      .collect();

    let deletedCount = 0;
    for (const file of files) {
      // Don't delete internal files or keys (both Apple .p8 kinds).
      if (
        file.isInternal ||
        file.purpose === "apple_p8_key" ||
        file.purpose === "apple_p8_asc_api_key"
      ) {
        continue;
      }

      try {
        await ctx.storage.delete(file.storageId);
        await ctx.db.delete(file._id);
        deletedCount++;
      } catch (error) {
        console.error("Failed to delete file", {
          fileId: file._id,
          error: describeErrorForLog(error),
        });
      }
    }

    return { deletedCount };
  },
});
