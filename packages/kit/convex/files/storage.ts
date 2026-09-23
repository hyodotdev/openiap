import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Whether a file row or a legacy organization avatar already references this
 * blob. Both lookups are indexed, and their range reads make the caller retry
 * through Convex OCC if a concurrent mutation claims the same storage ID.
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
 * Delete a storage object if its system row still exists. A retried cascade
 * may find the blob already gone, so absence counts as success; lookup and
 * delete errors still propagate so they get retried.
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
