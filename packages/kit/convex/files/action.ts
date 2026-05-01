"use node";
import { action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";

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

    const file: {
      _id: Id<"files">;
      fileName: string;
      organizationId: Id<"organizations">;
      mimeType?: string;
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
      mimeType: file.mimeType ?? "application/octet-stream",
      base64: result.content,
    };
  },
});
