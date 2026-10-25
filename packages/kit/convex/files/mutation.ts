import { assertCliScope } from "../cli/scope";
import { internalMutation, mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import { getOrganizationById, getProjectById } from "../projects/helpers";
import {
  deleteFileAndStorageIfUnreferenced,
  deleteStorageIfUnreferenced,
  isStorageReferenced,
} from "./storage";
import {
  appleP8PurposeValidator,
  validateFileUpload,
  type AppleP8Purpose,
} from "./validation";

export const FILE_UPLOAD_RESERVATION_TTL_MS = 15 * 60 * 1000;
// Convex upload URLs last one hour and an upload POST can take two minutes;
// the margin lets the final save call still reclaim any uploaded blob.
export const FILE_UPLOAD_RESERVATION_CLEANUP_TTL_MS = 75 * 60 * 1000;
// Four uploadable file kinds, one retry each. The indexed range read makes
// concurrent requests respect the cap through Convex OCC.
export const MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET = 8;
export const GOOGLE_SERVICE_ACCOUNT_CLEANUP_BATCH_SIZE = 16;
export const GOOGLE_SERVICE_ACCOUNT_RECOVERY_PROJECT_BATCH_SIZE = 20;
export const GOOGLE_SERVICE_ACCOUNT_RECOVERY_INTERVAL_MS = 5 * 60 * 1000;

async function drainGoogleServiceAccountFilesBatch(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  activeFileId: Id<"files"> | null,
): Promise<void> {
  const project = await ctx.db.get(projectId);
  if (!project || project.googlePlayServiceAccountFileId !== activeFileId) {
    return;
  }
  const page = await ctx.db
    .query("files")
    .withIndex("by_project_and_purpose", (q) =>
      q.eq("projectId", projectId).eq("purpose", "android_service_account"),
    )
    .take(GOOGLE_SERVICE_ACCOUNT_CLEANUP_BATCH_SIZE + 1);
  const staleFiles = page
    .filter((file) => file._id !== activeFileId)
    .slice(0, GOOGLE_SERVICE_ACCOUNT_CLEANUP_BATCH_SIZE);
  for (const staleFile of staleFiles) {
    await deleteFileAndStorageIfUnreferenced(ctx, staleFile);
  }
  if (staleFiles.length === GOOGLE_SERVICE_ACCOUNT_CLEANUP_BATCH_SIZE) {
    await ctx.scheduler.runAfter(
      0,
      internal.files.mutation.drainGoogleServiceAccountFiles,
      { projectId, activeFileId },
    );
  } else {
    await ctx.db.patch(projectId, {
      googlePlayServiceAccountCleanupPending: false,
      googlePlayServiceAccountCleanupRecoveryAt: undefined,
    });
  }
}

export const drainGoogleServiceAccountFiles = internalMutation({
  args: {
    projectId: v.id("projects"),
    activeFileId: v.union(v.id("files"), v.null()),
  },
  handler: async (ctx, args) => {
    await drainGoogleServiceAccountFilesBatch(
      ctx,
      args.projectId,
      args.activeFileId,
    );
  },
});

export const resumeGoogleServiceAccountCleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_google_service_account_cleanup", (q) =>
        q
          .eq("googlePlayServiceAccountCleanupPending", true)
          .lte("googlePlayServiceAccountCleanupRecoveryAt", now),
      )
      .take(GOOGLE_SERVICE_ACCOUNT_RECOVERY_PROJECT_BATCH_SIZE);

    for (const project of projects) {
      const activeFileId = project.googlePlayServiceAccountFileId;
      if (activeFileId === undefined) {
        await ctx.db.patch(project._id, {
          googlePlayServiceAccountCleanupPending: false,
          googlePlayServiceAccountCleanupRecoveryAt: undefined,
        });
        continue;
      }
      await ctx.db.patch(project._id, {
        googlePlayServiceAccountCleanupRecoveryAt:
          now + GOOGLE_SERVICE_ACCOUNT_RECOVERY_INTERVAL_MS,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.files.mutation.drainGoogleServiceAccountFiles,
        { projectId: project._id, activeFileId },
      );
    }
  },
});

async function deleteUnclaimedUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  // A deletion that runs between `generateUploadUrl` and `saveFile` cannot
  // find this blob, which has no file row yet, so reclaim it here.
  await deleteStorageIfUnreferenced(ctx, storageId);
}

function isAppleP8Purpose(purpose: string): purpose is AppleP8Purpose {
  return purpose === "apple_p8_key" || purpose === "apple_p8_asc_api_key";
}

type CredentialSaveDenial =
  | "TARGET_PENDING_DELETION"
  | "AUTHORIZATION_LOST"
  | "INSUFFICIENT_PERMISSIONS";

// Every stored file is a project credential or private asset: admins only.
async function checkCredentialSaveAccess(
  ctx: MutationCtx,
  target: {
    organizationId: Id<"organizations">;
    projectId?: Id<"projects">;
    userId: Id<"users"> | null;
  },
): Promise<{ userId: Id<"users"> } | { denial: CredentialSaveDenial }> {
  const organization = await ctx.db.get(target.organizationId);
  if (!organization || organization.pendingDeletion) {
    return { denial: "TARGET_PENDING_DELETION" };
  }
  if (target.projectId) {
    const project = await ctx.db.get(target.projectId);
    if (
      !project ||
      project.organizationId !== target.organizationId ||
      project.pendingDeletion === true
    ) {
      return { denial: "TARGET_PENDING_DELETION" };
    }
  }
  const userId = target.userId;
  if (!userId) return { denial: "AUTHORIZATION_LOST" };
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("organizationId", target.organizationId).eq("userId", userId),
    )
    .first();
  if (!membership) return { denial: "AUTHORIZATION_LOST" };
  if (membership.role === "member") {
    return { denial: "INSUFFICIENT_PERMISSIONS" };
  }
  return { userId };
}

export type AppleP8SaveResult =
  | {
      success: true;
      _id: Id<"files">;
      fileName: string;
      fileType: string;
      fileSize: number;
      purpose: AppleP8Purpose;
      createdAt: number;
    }
  | { success: false; code: "INVALID_FILE"; message: string }
  | { success: false; code: CredentialSaveDenial };

// Called by `saveAppleP8Key` after it parsed the key. One key per project
// slot, so verification and the dashboard always agree on which is active.
export const insertAppleP8Key = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
    purpose: appleP8PurposeValidator,
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<AppleP8SaveResult> => {
    const access = await checkCredentialSaveAccess(ctx, {
      organizationId: args.organizationId,
      projectId: args.projectId,
      userId: await getAuthUserId(ctx),
    });
    if ("denial" in access) return { success: false, code: access.denial };
    const priorFiles = await ctx.db
      .query("files")
      .withIndex("by_project_and_purpose", (q) =>
        q.eq("projectId", args.projectId).eq("purpose", args.purpose),
      )
      .collect();
    const now = Date.now();
    const fileId = await ctx.db.insert("files", {
      organizationId: args.organizationId,
      projectId: args.projectId,
      uploadedBy: access.userId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      purpose: args.purpose,
      isInternal: true,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    for (const priorFile of priorFiles) {
      await deleteFileAndStorageIfUnreferenced(ctx, priorFile);
    }
    return {
      success: true,
      _id: fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      purpose: args.purpose,
      createdAt: now,
    };
  },
});

export const saveFile = mutation({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    // One-time, target-bound capability issued with the upload URL. It still
    // lets this mutation reclaim the upload after a deletion ends the session.
    uploadReservationId: v.id("fileUploadReservations"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    purpose: v.union(
      v.literal("apple_p8_key"),
      v.literal("apple_p8_asc_api_key"),
      v.literal("android_service_account"),
      v.literal("apple_iap_review_screenshot"),
    ),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    isInternal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "admin");
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
      // Someone else's leaked reservation must not become a way for a
      // signed-in user to delete arbitrary storage.
      throw new ConvexError("Invalid upload reservation");
    }

    if (reservation.expiresAt <= now) {
      // Too late to save, but still in the cleanup grace: reclaim the slow
      // upload so its blob is not orphaned.
      await deleteUnclaimedUpload(ctx, args.storageId);
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "UPLOAD_RESERVATION_EXPIRED" as const,
      };
    }

    // .p8 keys are parsed before storage by `saveAppleP8Key`; this path cannot
    // read the blob, so it never registers one.
    if (isAppleP8Purpose(args.purpose)) {
      await deleteUnclaimedUpload(ctx, args.storageId);
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "INVALID_FILE" as const,
        message: "Upload .p8 keys through saveAppleP8Key.",
      };
    }

    // Without access the reservation still authorizes reclaiming the blob.
    const access = await checkCredentialSaveAccess(ctx, {
      organizationId: args.organizationId,
      projectId: args.projectId,
      userId,
    });
    if ("denial" in access) {
      await deleteUnclaimedUpload(ctx, args.storageId);
      await ctx.db.delete(reservation._id);
      return { success: false as const, code: access.denial };
    }

    // One application reference per blob (see `isStorageReferenced`).
    if (await isStorageReferenced(ctx, args.storageId)) {
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "UPLOAD_ALREADY_REGISTERED" as const,
      };
    }

    // Read the storage row right before the insert. A concurrent deletion
    // cleanup writes the same row, so OCC retries this mutation, which then
    // sees null instead of inserting a dangling file row.
    const uploadedFile = await ctx.db.system.get("_storage", args.storageId);
    if (!uploadedFile) {
      await ctx.db.delete(reservation._id);
      return {
        success: false as const,
        code: "UPLOAD_NOT_FOUND" as const,
      };
    }

    if (args.purpose === "apple_iap_review_screenshot") {
      try {
        if (!args.projectId) {
          throw new ConvexError(
            "App Review screenshots must belong to a project",
          );
        }
        validateFileUpload(
          args.fileName,
          args.fileType,
          args.fileSize,
          args.purpose,
        );
        // Trust the system storage record, not browser-supplied metadata. This
        // catches a client that reserves a small file but uploads a larger one.
        if (uploadedFile.size !== args.fileSize) {
          throw new ConvexError(
            "App Review screenshot size does not match the uploaded blob",
          );
        }
        const validated = reservation.validatedAppleReviewScreenshot;
        if (
          !validated ||
          validated.storageId !== args.storageId ||
          validated.fileName !== args.fileName ||
          validated.fileType !== args.fileType ||
          validated.fileSize !== args.fileSize
        ) {
          throw new ConvexError(
            "App Review screenshot binary was not validated by the server",
          );
        }
      } catch (error) {
        await deleteUnclaimedUpload(ctx, args.storageId);
        await ctx.db.delete(reservation._id);
        return {
          success: false as const,
          code: "INVALID_FILE" as const,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
    if (args.purpose === "android_service_account") {
      try {
        validateFileUpload(
          args.fileName,
          args.fileType,
          args.fileSize,
          "credential",
        );
        if (!args.projectId || !args.fileName.toLowerCase().endsWith(".json")) {
          throw new ConvexError(
            "Google service-account files must be project JSON files",
          );
        }
        if (uploadedFile.size !== args.fileSize) {
          throw new ConvexError(
            "Google service-account size does not match the uploaded blob",
          );
        }
        const validated = reservation.validatedGoogleServiceAccount;
        if (
          !validated ||
          validated.storageId !== args.storageId ||
          validated.fileName !== args.fileName ||
          validated.fileType !== args.fileType ||
          validated.fileSize !== args.fileSize
        ) {
          throw new ConvexError(
            "Google service-account JSON was not validated by the server",
          );
        }
      } catch (error) {
        await deleteUnclaimedUpload(ctx, args.storageId);
        await ctx.db.delete(reservation._id);
        return {
          success: false as const,
          code: "INVALID_FILE" as const,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // App Review screenshots remain a single project slot. Google credentials
    // use an active-file pointer and bounded background cleanup below.
    const filesToReplace =
      args.purpose === "apple_iap_review_screenshot" && args.projectId
        ? await ctx.db
            .query("files")
            .withIndex("by_project_and_purpose", (q) =>
              q.eq("projectId", args.projectId).eq("purpose", args.purpose),
            )
            .collect()
        : [];

    const fileId = await ctx.db.insert("files", {
      organizationId: args.organizationId,
      projectId: args.projectId,
      uploadedBy: access.userId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      purpose: args.purpose,
      description: args.description,
      metadata: args.metadata,
      isInternal: true,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    for (const priorFile of filesToReplace) {
      await deleteFileAndStorageIfUnreferenced(ctx, priorFile);
    }
    if (args.purpose === "android_service_account" && args.projectId) {
      await ctx.db.patch(args.projectId, {
        googlePlayServiceAccountFileId: fileId,
        googlePlayServiceAccountCleanupPending: true,
        googlePlayServiceAccountCleanupRecoveryAt:
          now + GOOGLE_SERVICE_ACCOUNT_RECOVERY_INTERVAL_MS,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.files.mutation.drainGoogleServiceAccountFiles,
        { projectId: args.projectId, activeFileId: fileId },
      );
    }

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

export const markAppleReviewScreenshotValidated = internalMutation({
  args: {
    uploadReservationId: v.id("fileUploadReservations"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.uploadReservationId);
    const alreadyValidated = reservation?.validatedAppleReviewScreenshot;
    if (
      reservation &&
      reservation.createdBy === args.userId &&
      reservation.expiresAt > Date.now() &&
      alreadyValidated?.storageId === args.storageId &&
      alreadyValidated.fileName === args.fileName &&
      alreadyValidated.fileType === args.fileType &&
      alreadyValidated.fileSize === args.fileSize
    ) {
      return;
    }
    if (
      !reservation ||
      reservation.createdBy !== args.userId ||
      reservation.expiresAt <= Date.now() ||
      reservation.pendingAppleReviewScreenshotStorageId !== args.storageId
    ) {
      throw new ConvexError("Invalid upload reservation");
    }
    const uploadedFile = await ctx.db.system.get("_storage", args.storageId);
    if (!uploadedFile || uploadedFile.size !== args.fileSize) {
      throw new ConvexError("Uploaded screenshot size does not match storage");
    }
    await ctx.db.patch(reservation._id, {
      pendingAppleReviewScreenshotStorageId: undefined,
      validatedAppleReviewScreenshot: {
        storageId: args.storageId,
        fileName: args.fileName,
        fileType: args.fileType,
        fileSize: args.fileSize,
      },
    });
  },
});

export const markGoogleServiceAccountValidated = internalMutation({
  args: {
    uploadReservationId: v.id("fileUploadReservations"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    clientEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.uploadReservationId);
    if (
      !reservation ||
      reservation.createdBy !== args.userId ||
      reservation.expiresAt <= Date.now() ||
      reservation.pendingGoogleServiceAccountStorageId !== args.storageId
    ) {
      throw new ConvexError("Invalid upload reservation");
    }
    const uploadedFile = await ctx.db.system.get("_storage", args.storageId);
    if (!uploadedFile || uploadedFile.size !== args.fileSize) {
      throw new ConvexError("Uploaded credential size does not match storage");
    }
    await ctx.db.patch(reservation._id, {
      pendingGoogleServiceAccountStorageId: undefined,
      validatedGoogleServiceAccount: {
        storageId: args.storageId,
        fileName: args.fileName,
        fileType: args.fileType,
        fileSize: args.fileSize,
        clientEmail: args.clientEmail,
      },
    });
  },
});

export const markGoogleServiceAccountValidationPending = internalMutation({
  args: {
    uploadReservationId: v.id("fileUploadReservations"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.uploadReservationId);
    if (
      !reservation ||
      reservation.createdBy !== args.userId ||
      reservation.expiresAt <= Date.now()
    ) {
      throw new ConvexError("Invalid upload reservation");
    }
    const existingStorageId =
      reservation.pendingGoogleServiceAccountStorageId ??
      reservation.validatedGoogleServiceAccount?.storageId;
    if (existingStorageId && existingStorageId !== args.storageId) {
      throw new ConvexError("Upload reservation is already bound to a file");
    }
    const uploadedFile = await ctx.db.system.get("_storage", args.storageId);
    if (!uploadedFile || uploadedFile.size !== args.fileSize) {
      throw new ConvexError("Uploaded credential size does not match storage");
    }
    await ctx.db.patch(reservation._id, {
      pendingGoogleServiceAccountStorageId: args.storageId,
    });
  },
});

export const rejectGoogleServiceAccountValidation = internalMutation({
  args: {
    uploadReservationId: v.id("fileUploadReservations"),
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.uploadReservationId);
    if (
      !reservation ||
      reservation.organizationId !== args.organizationId ||
      reservation.projectId !== args.projectId
    ) {
      return;
    }
    if (
      reservation.validatedGoogleServiceAccount?.storageId === args.storageId
    ) {
      return;
    }
    await deleteUnclaimedUpload(ctx, args.storageId);
    const boundStorageId =
      reservation.pendingGoogleServiceAccountStorageId ??
      reservation.validatedGoogleServiceAccount?.storageId;
    if (!boundStorageId || boundStorageId === args.storageId) {
      await ctx.db.delete(reservation._id);
    }
  },
});

export const markAppleReviewScreenshotValidationPending = internalMutation({
  args: {
    uploadReservationId: v.id("fileUploadReservations"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.uploadReservationId);
    if (
      !reservation ||
      reservation.createdBy !== args.userId ||
      reservation.expiresAt <= Date.now()
    ) {
      throw new ConvexError("Invalid upload reservation");
    }
    const existingStorageId =
      reservation.pendingAppleReviewScreenshotStorageId ??
      reservation.validatedAppleReviewScreenshot?.storageId;
    if (existingStorageId && existingStorageId !== args.storageId) {
      throw new ConvexError("Upload reservation is already bound to a file");
    }
    const uploadedFile = await ctx.db.system.get("_storage", args.storageId);
    if (!uploadedFile || uploadedFile.size !== args.fileSize) {
      throw new ConvexError("Uploaded screenshot size does not match storage");
    }
    await ctx.db.patch(reservation._id, {
      pendingAppleReviewScreenshotStorageId: args.storageId,
    });
  },
});

export const rejectAppleReviewScreenshotValidation = internalMutation({
  args: {
    uploadReservationId: v.id("fileUploadReservations"),
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.uploadReservationId);
    if (
      !reservation ||
      reservation.organizationId !== args.organizationId ||
      reservation.projectId !== args.projectId
    ) {
      return;
    }
    if (
      reservation.validatedAppleReviewScreenshot?.storageId === args.storageId
    ) {
      // Another validation of the same immutable blob already completed. A
      // slower duplicate attempt must not erase the successful marker/blob.
      return;
    }
    await deleteUnclaimedUpload(ctx, args.storageId);
    const boundStorageId =
      reservation.pendingAppleReviewScreenshotStorageId ??
      reservation.validatedAppleReviewScreenshot?.storageId;
    // Keep the reservation if a concurrent validation bound it to another blob.
    if (!boundStorageId || boundStorageId === args.storageId) {
      await ctx.db.delete(reservation._id);
    }
  },
});

export const remove = mutation({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "admin");
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

    let revokesGoogleServiceAccount = false;
    if (
      file.purpose === "android_service_account" &&
      file.projectId &&
      project
    ) {
      if (project.googlePlayServiceAccountFileId === file._id) {
        revokesGoogleServiceAccount = true;
      } else if (project.googlePlayServiceAccountFileId === undefined) {
        const legacyActiveFile = await ctx.db
          .query("files")
          .withIndex("by_project_and_purpose", (q) =>
            q
              .eq("projectId", file.projectId as Id<"projects">)
              .eq("purpose", "android_service_account"),
          )
          .order("desc")
          .first();
        revokesGoogleServiceAccount = legacyActiveFile?._id === file._id;
      }
    }
    if (revokesGoogleServiceAccount && file.projectId) {
      await ctx.db.patch(file.projectId, {
        googlePlayServiceAccountFileId: null,
        googlePlayServiceAccountCleanupPending: true,
        googlePlayServiceAccountCleanupRecoveryAt:
          Date.now() + GOOGLE_SERVICE_ACCOUNT_RECOVERY_INTERVAL_MS,
      });
      await deleteFileAndStorageIfUnreferenced(ctx, file);
      await ctx.scheduler.runAfter(
        0,
        internal.files.mutation.drainGoogleServiceAccountFiles,
        { projectId: file.projectId, activeFileId: null },
      );
    } else {
      await deleteFileAndStorageIfUnreferenced(ctx, file);
    }

    return { success: true };
  },
});

export const generateUploadUrl = mutation({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    await assertCliScope(ctx, "admin");
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
