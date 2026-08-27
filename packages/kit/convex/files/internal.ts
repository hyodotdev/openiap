import {
  internalQuery,
  internalMutation,
  internalAction,
} from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import {
  deleteFileAndStorageIfUnreferenced,
  deleteStorageIfUnreferenced,
} from "./storage";

export const UPLOAD_RESERVATION_PRUNE_BATCH_SIZE = 200;

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

export const getUploadReservationForValidation = internalQuery({
  args: {
    uploadReservationId: v.id("fileUploadReservations"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => ({
    reservation: await ctx.db.get(args.uploadReservationId),
    storage: await ctx.db.system.get("_storage", args.storageId),
  }),
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
      fileType: file.fileType,
      fileSize: file.fileSize,
      purpose: file.purpose,
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
      v.literal("apple_iap_review_screenshot"),
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

// Exact-project lookup for the private App Review screenshot. The temporary
// storage URL is returned only from this internal query so the Node ASC worker
// can stream/fetch the blob directly instead of expanding a 10 MB image into a
// binary string plus base64 inside the smaller V8 isolate. It is never exposed
// by a public query or action.
export const getAppleReviewScreenshotByProjectInternal = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .filter((q) => q.eq(q.field("purpose"), "apple_iap_review_screenshot"))
      .first();
    if (!file) return null;
    const storageUrl = await ctx.storage.getUrl(file.storageId);
    if (!storageUrl) {
      throw new ConvexError("App Review screenshot content not found");
    }
    return {
      fileId: file._id,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      createdAt: file.createdAt,
      storageUrl,
    };
  },
});

export async function getGooglePlayFileByProjectFromDb(
  ctx: Pick<QueryCtx, "db">,
  project: Doc<"projects">,
): Promise<Doc<"files"> | null> {
  if (project.googlePlayServiceAccountFileId === null) return null;
  if (project.googlePlayServiceAccountFileId !== undefined) {
    const activeFile = await ctx.db.get(project.googlePlayServiceAccountFileId);
    return activeFile?.projectId === project._id &&
      activeFile.purpose === "android_service_account"
      ? activeFile
      : null;
  }
  return await ctx.db
    .query("files")
    .withIndex("by_project_and_purpose", (q) =>
      q.eq("projectId", project._id).eq("purpose", "android_service_account"),
    )
    .order("desc")
    .first();
}

// Internal query to get the active Google Play service account file.
export const getGooglePlayFileByProjectInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    return await getGooglePlayFileByProjectFromDb(ctx, project);
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
      // Don't delete internal files, keys (both Apple .p8 kinds), or review
      // screenshots. The purpose guard protects legacy/malformed screenshot
      // rows even if isInternal was false.
      if (
        file.isInternal ||
        file.purpose === "apple_p8_key" ||
        file.purpose === "apple_p8_asc_api_key" ||
        file.purpose === "apple_iap_review_screenshot"
      ) {
        continue;
      }

      try {
        await deleteFileAndStorageIfUnreferenced(ctx, file);
        deletedCount++;
      } catch (error) {
        console.error("Failed to delete file", {
          fileId: file._id,
          error: describeErrorForLog(error),
        });
        // The helper deletes the file row before checking/reclaiming its final
        // storage reference. Let the mutation fail so Convex rolls that row
        // deletion back atomically; swallowing the error would commit a new
        // orphan blob with no row for a later cleanup retry to discover.
        throw error;
      }
    }

    return { deletedCount };
  },
});

// Most expired upload reservations carry no storageId because the storage
// service assigns it only after the client POSTs to the signed URL. Screenshot
// validation deliberately claims that id before its Node action downloads the
// blob, so the bounded sweep must also reclaim claimed-but-unsaved objects.
export const pruneUploadReservations = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ deletedCount: v.number() }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(
      Math.max(
        Math.trunc(args.batchSize ?? UPLOAD_RESERVATION_PRUNE_BATCH_SIZE),
        1,
      ),
      UPLOAD_RESERVATION_PRUNE_BATCH_SIZE,
    );
    const expired = await ctx.db
      .query("fileUploadReservations")
      .withIndex("by_cleanup_expires_at", (q) =>
        q.lte("cleanupExpiresAt", Date.now()),
      )
      .take(batchSize);

    for (const reservation of expired) {
      const claimedStorageIds = new Set(
        [
          reservation.pendingAppleReviewScreenshotStorageId ??
            reservation.validatedAppleReviewScreenshot?.storageId,
          reservation.pendingGoogleServiceAccountStorageId ??
            reservation.validatedGoogleServiceAccount?.storageId,
        ].filter((storageId): storageId is Id<"_storage"> =>
          Boolean(storageId),
        ),
      );
      for (const storageId of claimedStorageIds) {
        await deleteStorageIfUnreferenced(ctx, storageId);
      }
      await ctx.db.delete(reservation._id);
    }

    // A full page means more expired rows may already be queued. Chain another
    // bounded transaction immediately instead of waiting an hour while an
    // authenticated-abuse backlog grows faster than the cron can drain it.
    if (expired.length === batchSize) {
      await ctx.scheduler.runAfter(
        0,
        internal.files.internal.pruneUploadReservations,
        { batchSize },
      );
    }

    return { deletedCount: expired.length };
  },
});
