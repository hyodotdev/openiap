import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { hmacSha256Hex, sha256Hex } from "../utils/sha256";

export async function isUserErasureRequested(
  ctx: QueryCtx,
  project: Doc<"projects">,
  userId: string,
): Promise<boolean> {
  const hashes = [await sha256Hex(userId)];
  if (project.userErasureHashKey)
    hashes.push(await hmacSha256Hex(project.userErasureHashKey, userId));
  for (const userIdHash of hashes) {
    const job = await ctx.db
      .query("subscriptionUserErasureJobs")
      .withIndex("by_project_and_user_hash", (q) =>
        q.eq("projectId", project._id).eq("userIdHash", userIdHash),
      )
      .unique();
    if (job) return true;
  }
  return false;
}
