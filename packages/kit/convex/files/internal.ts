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

    const blob = await ctx.storage.get(file.storageId);
    if (!blob) {
      throw new ConvexError("File content not found in storage");
    }

    // Update access tracking
    // await ctx.runMutation(internal.files.internal.updateFileAccess, {
    //   fileId: args.fileId,
    //   accessCount: (file.accessCount || 0) + 1,
    // });

    const text = await blob.text();

    return {
      fileId: file._id,
      fileName: file.fileName,
      content: text,
      metadata: file.metadata,
    };
  },
});

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

    const blob = await ctx.storage.get(file.storageId);
    if (!blob) {
      throw new ConvexError("File content not found in storage");
    }

    // Update access tracking
    // await ctx.runMutation(internal.files.internal.updateFileAccess, {
    //   fileId: args.fileId,
    //   accessCount: (file.accessCount || 0) + 1,
    // });

    // No `Buffer` global in the V8 runtime (no "use node"), so use `btoa`.
    // Chunks stay under the `String.fromCharCode` argument limit, and one
    // `join` avoids quadratic string concatenation on multi-megabyte files.
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

// What `findFilesByPurpose` returns: callers like `getAppleP8Key` must not
// see `storageId` or `uploadedBy`. Declared explicitly because inference
// through the Convex handler would give callers `any[]`.
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

// Returns the storage URL so the Node ASC worker fetches the screenshot
// itself instead of base64-expanding up to 10 MB in the smaller V8 isolate.
// Never return this URL from a public query or action.
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

// A different .p8 than `getAppleP8Key` returns (see schema.ts).
// Used by `products/asc.ts` push-sync.
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
      // The screenshot purpose check also covers legacy rows where
      // isInternal is false.
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
        // Rethrow so Convex rolls back the row delete. Swallowing the error
        // would leave an orphan blob with no row for a retry to find.
        throw error;
      }
    }

    return { deletedCount };
  },
});

// Most expired reservations have no storageId: storage assigns one only when
// the client POSTs the upload. Validation claims the id before downloading
// the blob, so the sweep also reclaims claimed-but-unsaved blobs.
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

    // A full batch means more rows may be expired. Continue now instead of
    // waiting an hour for the cron while an abuse backlog grows.
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
