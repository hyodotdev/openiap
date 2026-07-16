import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getOrganizationById, getProjectById } from "../projects/helpers";
import {
  deleteFileAndStorageIfUnreferenced,
  deleteStorageIfUnreferenced,
  isStorageReferenced,
} from "./storage";

export const FILE_UPLOAD_RESERVATION_TTL_MS = 15 * 60 * 1000;
// Convex upload URLs last one hour and an upload POST may run for two minutes.
// Keep a small buffer beyond both limits so every successfully uploaded blob
// can still be reclaimed by the terminal save call.
export const FILE_UPLOAD_RESERVATION_CLEANUP_TTL_MS = 75 * 60 * 1000;
// Three credential kinds can be uploaded from project settings. Keep room for
// one retry of each while still bounding reservation-table growth per user and
// target. The indexed range read makes concurrent issuance respect the cap via
// Convex OCC.
export const MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET = 6;

async function deleteUnclaimedUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  // `generateUploadUrl` and `saveFile` are separate mutations. If deletion
  // starts between them, the uploaded blob has no file row for the cascade to
  // discover. Missing storage is already-clean; transient failures propagate
  // so Convex can retry instead of committing a leak.
  await deleteStorageIfUnreferenced(ctx, storageId);
}

export const saveFile = mutation({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    // This opaque, one-time ID is the capability issued alongside the upload
    // URL. It lets this mutation reclaim only an upload whose target was
    // authorized before an account/project deletion invalidated the session.
    uploadReservationId: v.id("fileUploadReservations"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    purpose: v.union(
      v.literal("apple_p8_key"),
      v.literal("apple_p8_asc_api_key"),
      v.literal("android_service_account"),
    ),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    isInternal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.uploadReservationId);
    if (
      !reservation ||
      reservation.organizationId !== args.organizationId ||
      reservation.projectId !== args.projectId
    ) {
      throw new ConvexError("Invalid upload reservation");
    }

    const now = Date.now();
    if (reservation.cleanupExpiresAt <= now) {
      // Past the bounded cleanup grace period, the capability authorizes no
      // operation at all. Normally the hourly pruner removes it first.
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "UPLOAD_RESERVATION_EXPIRED" as const,
      };
    }

    const userId = await getAuthUserId(ctx);
    if (userId && userId !== reservation.createdBy) {
      // Do not let a signed-in user consume another user's leaked capability.
      // In particular, never turn a mismatched reservation into an arbitrary
      // storage-deletion primitive.
      throw new ConvexError("Invalid upload reservation");
    }

    if (reservation.expiresAt <= now) {
      // Saving is no longer permitted, but the still-valid cleanup-only grace
      // capability closes the slow-upload race without leaving the newly-known
      // storageId orphaned. It remains target/creator-bound and one-time.
      await deleteUnclaimedUpload(ctx, args.storageId);
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "UPLOAD_RESERVATION_EXPIRED" as const,
      };
    }

    // The reservation is already target-bound, so raw target rows are safe to
    // inspect even when account deletion has removed the issuing user's auth
    // session and membership. That is the exact race the capability closes.
    const organization = await ctx.db.get(args.organizationId);

    let projectUnavailable = false;
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      projectUnavailable =
        !project ||
        project.organizationId !== args.organizationId ||
        project.pendingDeletion === true;
    }

    if (!organization || organization.pendingDeletion || projectUnavailable) {
      await deleteUnclaimedUpload(ctx, args.storageId);
      await ctx.db.delete(reservation._id);
      // Throwing here would roll the storage deletion back with the mutation.
      // Return a discriminated result so the caller can surface the failure
      // while Convex commits the orphan-blob cleanup.
      return {
        success: false as const,
        code: "TARGET_PENDING_DELETION" as const,
      };
    }

    if (!userId) {
      await deleteUnclaimedUpload(ctx, args.storageId);
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "AUTHORIZATION_LOST" as const,
      };
    }

    // A current membership is still required for the successful write path.
    // A valid one-time capability permits cleanup—not saving—after membership
    // disappears between the upload POST and this mutation.
    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();

    if (!membership) {
      await deleteUnclaimedUpload(ctx, args.storageId);
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "AUTHORIZATION_LOST" as const,
      };
    }

    // Bind each upload to exactly one application reference. Organization
    // avatars also reference `_storage` directly, so the shared indexed check
    // must protect both active claims and cleanup paths. Its range reads give
    // Convex a serializable dependency, preventing a concurrent reference from
    // being created between this check and the file insert.
    if (await isStorageReferenced(ctx, args.storageId)) {
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "UPLOAD_ALREADY_REGISTERED" as const,
      };
    }

    // Read the system storage row immediately before inserting the file row.
    // A concurrent pending-deletion cleanup writes that same storage row, so
    // Convex OCC retries this mutation; the retry then observes null instead
    // of committing a dangling files document.
    const uploadedFile = await ctx.db.system.get("_storage", args.storageId);
    if (!uploadedFile) {
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "UPLOAD_NOT_FOUND" as const,
      };
    }

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

    // Consume the capability in the same transaction as the file insert so a
    // retry can never register or reclaim a second storage object with it.
    await ctx.db.delete(reservation._id);

    // Return only safe metadata, never the storageId
    return {
      success: true as const,
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

    const organization = await getOrganizationById(ctx, file.organizationId);
    const project = file.projectId
      ? await getProjectById(ctx, file.projectId)
      : null;
    if (!organization || (file.projectId && !project)) {
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

    await deleteFileAndStorageIfUnreferenced(ctx, file);

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

    const organization = await getOrganizationById(ctx, file.organizationId);
    const project = file.projectId
      ? await getProjectById(ctx, file.projectId)
      : null;
    if (!organization || (file.projectId && !project)) {
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
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const membership = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId),
      )
      .first();
    if (!membership) {
      throw new ConvexError("Not a member of this organization");
    }

    const organization = await getOrganizationById(ctx, args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    if (args.projectId) {
      const project = await getProjectById(ctx, args.projectId);
      if (!project || project.organizationId !== args.organizationId) {
        throw new ConvexError("Project not found");
      }
    }

    const now = Date.now();
    const activeReservations = await ctx.db
      .query("fileUploadReservations")
      .withIndex("by_creator_target_and_cleanup_expiry", (q) =>
        q
          .eq("createdBy", userId)
          .eq("organizationId", args.organizationId)
          .eq("projectId", args.projectId)
          .gt("cleanupExpiresAt", now),
      )
      .take(MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET);
    if (
      activeReservations.length >=
      MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET
    ) {
      throw new ConvexError(
        "Too many active upload reservations for this project. Finish or retry the existing uploads before requesting another URL.",
      );
    }

    const uploadReservationId = await ctx.db.insert("fileUploadReservations", {
      organizationId: args.organizationId,
      projectId: args.projectId,
      createdBy: userId,
      expiresAt: now + FILE_UPLOAD_RESERVATION_TTL_MS,
      cleanupExpiresAt: now + FILE_UPLOAD_RESERVATION_CLEANUP_TTL_MS,
      createdAt: now,
    });

    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
      uploadReservationId,
      expiresAt: now + FILE_UPLOAD_RESERVATION_TTL_MS,
    };
  },
});
