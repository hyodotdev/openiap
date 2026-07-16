import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Return whether an application row already owns a Convex storage object.
 *
 * File uploads are not the only storage references in the current schema:
 * legacy organization avatars point at `_storage` directly. Both lookups are
 * indexed so cleanup and claim paths can protect shared blobs without scanning
 * either table. Reading both index ranges also gives Convex OCC enough
 * information to retry if a concurrent mutation claims the same storage ID.
 */
export async function isStorageReferenced(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<boolean> {
  const [file, organizationAvatar] = await Promise.all([
    ctx.db
      .query("files")
      .withIndex("by_storage_id", (q) => q.eq("storageId", storageId))
      .first(),
    ctx.db
      .query("organizations")
      .withIndex("by_avatar_file_id", (q) => q.eq("avatarFileId", storageId))
      .first(),
  ]);

  return file !== null || organizationAvatar !== null;
}

/** Delete a storage object only after every application reference is gone. */
export async function deleteStorageIfUnreferenced(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  if (await isStorageReferenced(ctx, storageId)) return;
  await deleteStorageIfPresent(ctx, storageId);
}

/**
 * Remove one file reference, then reclaim its blob only when it was the final
 * reference. Older deployments allowed duplicate file/avatar references, so
 * deleting storage before the row could break another live owner.
 */
export async function deleteFileAndStorageIfUnreferenced(
  ctx: MutationCtx,
  file: Pick<Doc<"files">, "_id" | "storageId">,
): Promise<void> {
  await ctx.db.delete(file._id);
  await deleteStorageIfUnreferenced(ctx, file.storageId);
}

/**
 * Delete a Convex storage object only when its system row still exists.
 *
 * Deletion cascades are retried and can resume after a prior transaction
 * removed the blob but not its application row. Treating an absent storage
 * object as success keeps those cascades idempotent. Metadata lookup or
 * deletion failures still propagate so transient infrastructure errors are
 * retried instead of being mistaken for a completed cleanup.
 */
export async function deleteStorageIfPresent(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (metadata) {
    await ctx.storage.delete(storageId);
  }
}
