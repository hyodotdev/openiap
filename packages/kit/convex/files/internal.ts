import {
  internalQuery,
  internalMutation,
  internalAction,
} from "../_generated/server";
import type { ActionCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { deleteStorageIfUnreferenced } from "./storage";
import { appleP8PurposeValidator, type AppleP8Purpose } from "./validation";

export const UPLOAD_RESERVATION_PRUNE_BATCH_SIZE = 200;

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

export const readFileAsText = internalAction({
  args: {
    fileId: v.id("files"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    fileId: Id<"files">;
    fileName: string;
    content: string;
    metadata: unknown;
  }> => {
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    fileId: Id<"files">;
    fileName: string;
    fileType: string;
    fileSize: number;
    purpose: Doc<"files">["purpose"];
    content: string;
    metadata: unknown;
  }> => {
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

    // No `Buffer` global in the V8 runtime (no "use node"), so use `btoa`.
    // Chunks stay under the `String.fromCharCode` argument limit, and one
    // `join` avoids quadratic string concatenation on multi-megabyte files.
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const CHUNK = 0x8000;
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += CHUNK) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
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

// One App Store Connect key serves the whole team, so a project may rely on a
// key uploaded elsewhere in its organization. Newest first: this project's,
// then an organization-level key (no projectId), then a sibling project's.
// Never another organization's.
export const getAppleP8KeyFile = internalQuery({
  args: {
    projectId: v.id("projects"),
    purpose: appleP8PurposeValidator,
  },
  handler: async (ctx, args) => {
    const projectKey = await ctx.db
      .query("files")
      .withIndex("by_project_and_purpose", (q) =>
        q.eq("projectId", args.projectId).eq("purpose", args.purpose),
      )
      .order("desc")
      .first();
    if (projectKey) return projectKey;
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;
    const organizationKeys = () =>
      ctx.db
        .query("files")
        .withIndex("by_org_and_purpose", (q) =>
          q
            .eq("organizationId", project.organizationId)
            .eq("purpose", args.purpose),
        )
        .order("desc");
    return (
      (await organizationKeys()
        .filter((q) => q.eq(q.field("projectId"), undefined))
        .first()) ?? (await organizationKeys().first())
    );
  },
});

/** The .p8 of `purpose` that `getAppleP8KeyFile` selects, or null. */
export async function readAppleP8Key(
  ctx: Pick<ActionCtx, "runQuery" | "storage">,
  projectId: Id<"projects">,
  purpose: AppleP8Purpose,
): Promise<string | null> {
  const file = await ctx.runQuery(internal.files.internal.getAppleP8KeyFile, {
    projectId,
    purpose,
  });
  const blob = file ? await ctx.storage.get(file.storageId) : null;
  return blob ? await blob.text() : null;
}

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
