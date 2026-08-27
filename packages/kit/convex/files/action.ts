"use node";
import { createPrivateKey } from "node:crypto";
import { action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import sharp from "sharp";
import type { Id } from "../_generated/dataModel";
import {
  validateAppleReviewScreenshotContent,
  validateFileUpload,
  validateGoogleServiceAccountContent,
} from "./validation";

const SCREENSHOT_FETCH_TIMEOUT_MS = 30_000;
const SCREENSHOT_MAX_INPUT_PIXELS = 25_000_000;

export function validateGoogleServiceAccountPrivateKey(
  privateKey: string,
): void {
  try {
    createPrivateKey(privateKey);
  } catch {
    throw new ConvexError(
      "Google service-account JSON contains an invalid private key",
    );
  }
}

/** Force a real image decode before a blob can receive the validation marker. */
export async function decodeAppleReviewScreenshot(
  bytes: Uint8Array,
  declaredMimeType: string,
): Promise<void> {
  validateAppleReviewScreenshotContent(bytes, declaredMimeType);
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    const decoder = sharp(bytes, {
      failOn: "error",
      limitInputPixels: SCREENSHOT_MAX_INPUT_PIXELS,
    });
    metadata = await decoder.metadata();
    // metadata() alone can succeed for a truncated payload. Decode every pixel
    // so malformed chunks/scan data are rejected before the blob reaches ASC.
    await decoder.clone().raw().toBuffer();
  } catch {
    throw new ConvexError(
      "App Review screenshot is truncated, corrupt, or too large to decode",
    );
  }
  const expectedFormat =
    declaredMimeType === "image/png"
      ? "png"
      : declaredMimeType === "image/jpeg"
        ? "jpeg"
        : null;
  if (
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new ConvexError(
      "App Review screenshot decoded format does not match its MIME type",
    );
  }
  if (metadata.hasAlpha) {
    throw new ConvexError(
      "App Review PNG screenshots cannot contain an alpha channel",
    );
  }
}

export const validateAppleReviewScreenshotUpload = action({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
    uploadReservationId: v.id("fileUploadReservations"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  returns: v.object({ valid: v.literal(true) }),
  handler: async (ctx, args): Promise<{ valid: true }> => {
    const userId = await getAuthUserId(ctx);
    const { reservation, storage } = await ctx.runQuery(
      internal.files.internal.getUploadReservationForValidation,
      {
        uploadReservationId: args.uploadReservationId,
        storageId: args.storageId,
      },
    );
    if (
      !reservation ||
      reservation.organizationId !== args.organizationId ||
      reservation.projectId !== args.projectId
    ) {
      throw new ConvexError("Invalid upload reservation");
    }
    // A signed-in user must never consume somebody else's leaked capability.
    // A missing session is different: the target-bound one-time reservation
    // still authorizes cleanup of the just-uploaded unclaimed blob.
    if (userId && reservation.createdBy !== userId) {
      throw new ConvexError("Invalid upload reservation");
    }

    try {
      if (!userId) throw new ConvexError("Not authenticated");
      if (reservation.expiresAt <= Date.now()) {
        throw new ConvexError("Upload reservation expired");
      }
      const membership = await ctx.runQuery(
        internal.organizations.internal.getMembership,
        { userId, organizationId: args.organizationId },
      );
      if (!membership || membership.role === "member") {
        throw new ConvexError("Insufficient permissions");
      }
      validateFileUpload(
        args.fileName,
        args.fileType,
        args.fileSize,
        "apple_iap_review_screenshot",
      );
      if (!storage || storage.size !== args.fileSize) {
        throw new ConvexError(
          "App Review screenshot size does not match the uploaded blob",
        );
      }
      await ctx.runMutation(
        internal.files.mutation.markAppleReviewScreenshotValidationPending,
        {
          uploadReservationId: args.uploadReservationId,
          userId,
          storageId: args.storageId,
          fileSize: args.fileSize,
        },
      );
      const storageUrl = await ctx.storage.getUrl(args.storageId);
      if (!storageUrl) {
        throw new ConvexError("App Review screenshot content not found");
      }
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        SCREENSHOT_FETCH_TIMEOUT_MS,
      );
      let response: Response;
      try {
        response = await fetch(storageUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        throw new ConvexError(
          `App Review screenshot download returned HTTP ${response.status}`,
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== args.fileSize) {
        throw new ConvexError(
          "App Review screenshot size changed while validating",
        );
      }
      await decodeAppleReviewScreenshot(bytes, args.fileType);
      await ctx.runMutation(
        internal.files.mutation.markAppleReviewScreenshotValidated,
        {
          uploadReservationId: args.uploadReservationId,
          userId,
          storageId: args.storageId,
          fileName: args.fileName,
          fileType: args.fileType,
          fileSize: args.fileSize,
        },
      );
      return { valid: true };
    } catch (error) {
      await ctx.runMutation(
        internal.files.mutation.rejectAppleReviewScreenshotValidation,
        {
          uploadReservationId: args.uploadReservationId,
          organizationId: args.organizationId,
          projectId: args.projectId,
          storageId: args.storageId,
        },
      );
      throw error;
    }
  },
});

export const validateGoogleServiceAccountUpload = action({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
    uploadReservationId: v.id("fileUploadReservations"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  returns: v.object({ valid: v.literal(true) }),
  handler: async (ctx, args): Promise<{ valid: true }> => {
    const userId = await getAuthUserId(ctx);
    const { reservation, storage } = await ctx.runQuery(
      internal.files.internal.getUploadReservationForValidation,
      {
        uploadReservationId: args.uploadReservationId,
        storageId: args.storageId,
      },
    );
    if (
      !reservation ||
      reservation.organizationId !== args.organizationId ||
      reservation.projectId !== args.projectId ||
      (userId && reservation.createdBy !== userId)
    ) {
      throw new ConvexError("Invalid upload reservation");
    }
    try {
      if (!userId) throw new ConvexError("Not authenticated");
      if (reservation.expiresAt <= Date.now()) {
        throw new ConvexError("Upload reservation expired");
      }
      const membership = await ctx.runQuery(
        internal.organizations.internal.getMembership,
        { userId, organizationId: args.organizationId },
      );
      if (!membership || membership.role === "member") {
        throw new ConvexError("Insufficient permissions");
      }
      validateFileUpload(
        args.fileName,
        args.fileType,
        args.fileSize,
        "credential",
      );
      if (!args.fileName.toLowerCase().endsWith(".json")) {
        throw new ConvexError("Google service-account file must be JSON");
      }
      if (!storage || storage.size !== args.fileSize) {
        throw new ConvexError(
          "Google service-account size does not match the uploaded blob",
        );
      }
      await ctx.runMutation(
        internal.files.mutation.markGoogleServiceAccountValidationPending,
        {
          uploadReservationId: args.uploadReservationId,
          userId,
          storageId: args.storageId,
          fileSize: args.fileSize,
        },
      );
      const blob = await ctx.storage.get(args.storageId);
      if (!blob || blob.size !== args.fileSize) {
        throw new ConvexError("Google service-account content not found");
      }
      const { clientEmail, privateKey } = validateGoogleServiceAccountContent(
        await blob.text(),
      );
      validateGoogleServiceAccountPrivateKey(privateKey);
      await ctx.runMutation(
        internal.files.mutation.markGoogleServiceAccountValidated,
        {
          uploadReservationId: args.uploadReservationId,
          userId,
          storageId: args.storageId,
          fileName: args.fileName,
          fileType: args.fileType,
          fileSize: args.fileSize,
          clientEmail,
        },
      );
      return { valid: true };
    } catch (error) {
      await ctx.runMutation(
        internal.files.mutation.rejectGoogleServiceAccountValidation,
        {
          uploadReservationId: args.uploadReservationId,
          organizationId: args.organizationId,
          projectId: args.projectId,
          storageId: args.storageId,
        },
      );
      throw error;
    }
  },
});

// Public action to download an uploaded credential file (Apple .p8 or
// Google service-account JSON). The dashboard's Settings page calls
// this so an org admin can re-fetch the original file they uploaded —
// useful when rotating keys, copying to a new project, or
// double-checking the file kit holds matches the one in App Store
// Connect / Play Console.
//
// Auth: same admin-or-owner check `files.mutation.remove` enforces.
// Members can't download because the .p8 / service-account JSON are
// effectively credentials.
//
// Returns the file content as a base64 string so the frontend can
// reconstruct a Blob and trigger a browser download. We don't return
// a storage URL because Convex storage URLs are publicly fetchable —
// the auth check belongs in this action, not on a URL the browser
// hands to a third-party.
export const downloadFile = action({
  args: { fileId: v.id("files") },
  returns: v.object({
    fileName: v.string(),
    mimeType: v.string(),
    base64: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ fileName: string; mimeType: string; base64: string }> => {
    const userId: Id<"users"> | null = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    // The Convex `files` table stores the MIME type in `fileType` (see
    // `files/internal.ts`). The prior typing pulled `mimeType` and so
    // every download fell back to `application/octet-stream` — the
    // dashboard would then build the Blob with the wrong content type
    // and the browser would mis-handle the .p8 / .json download.
    const file: {
      _id: Id<"files">;
      fileName: string;
      organizationId: Id<"organizations">;
      fileType?: string;
    } | null = await ctx.runQuery(internal.files.internal.getFileRecord, {
      fileId: args.fileId,
    });
    if (!file) {
      throw new ConvexError("File not found");
    }

    const membership = await ctx.runQuery(
      internal.organizations.internal.getMembership,
      { userId, organizationId: file.organizationId },
    );
    if (!membership || membership.role === "member") {
      throw new ConvexError("Insufficient permissions");
    }

    const result: { content: string; fileName: string } = await ctx.runAction(
      internal.files.internal.readFileAsBase64,
      { fileId: args.fileId },
    );

    return {
      fileName: result.fileName,
      mimeType: file.fileType ?? "application/octet-stream",
      base64: result.content,
    };
  },
});
