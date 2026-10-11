import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { amazonSubscriptionToken } from "../subscriptions/amazon";
import { isUserErasureRequested } from "../subscriptions/erasure";
import { MAX_BOUND_PURCHASES_PER_USER } from "../subscriptions/limits";

export async function makePurchaseBindingRoom(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  userId: string,
  store: Doc<"purchases">["store"],
  remoteId: string,
): Promise<boolean> {
  const bound = await ctx.db
    .query("purchases")
    .withIndex("by_project_and_app_user", (q) =>
      q.eq("projectId", projectId).eq("appUserId", userId),
    )
    .take(MAX_BOUND_PURCHASES_PER_USER);
  if (bound.length < MAX_BOUND_PURCHASES_PER_USER) return true;
  if (bound.some((row) => row.store === store && row.remoteId === remoteId))
    return true;
  // Reclaim only the caller's invalid receipts when the cap is contended.
  const reclaimed = bound.filter((row) => !(row.isValid ?? false));
  for (const row of reclaimed) {
    await ctx.db.patch(row._id, { appUserId: undefined });
    if (row.store === "amazon" && row.remoteId) {
      const token = amazonSubscriptionToken(row.remoteId);
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_project_and_token", (q) =>
          q.eq("projectId", projectId).eq("purchaseToken", token),
        )
        .unique();
      if (sub?.userId === userId)
        await ctx.db.patch(sub._id, { userId: undefined });
    }
  }
  if (reclaimed.length) return true;
  console.warn("[commerce] bindPurchase refused: bound purchase limit", {
    projectId,
    store,
  });
  return false;
}

export async function bindAmazonPurchaseOwner(
  ctx: MutationCtx,
  project: Doc<"projects">,
  sub: Doc<"subscriptions">,
  userId: string,
  allowRebind = false,
): Promise<boolean> {
  if (sub.store !== "amazon") return true;
  const prefix = amazonSubscriptionToken("");
  if (!sub.purchaseToken.startsWith(prefix)) return false;
  const remoteId = sub.purchaseToken.slice(prefix.length);
  const purchase = await ctx.db
    .query("purchases")
    .withIndex("by_project_and_remote", (q) =>
      q.eq("projectId", project._id).eq("remoteId", remoteId),
    )
    .filter((q) => q.eq(q.field("store"), "amazon"))
    .unique();
  if (!purchase) return false;
  if (purchase.appUserId && purchase.appUserId !== userId) {
    if (
      !allowRebind ||
      (await isUserErasureRequested(ctx, project, purchase.appUserId))
    )
      return false;
  }
  if (
    !(await makePurchaseBindingRoom(
      ctx,
      project._id,
      userId,
      "amazon",
      remoteId,
    ))
  )
    return false;
  await ctx.db.patch(purchase._id, {
    appUserId: userId,
    accountErased: undefined,
  });
  return true;
}
