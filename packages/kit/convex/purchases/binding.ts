import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { amazonSubscriptionToken } from "../subscriptions/amazon";
import { isUserErasureRequested } from "../subscriptions/erasure";
import type { BindOutcome } from "../subscriptions/internal";
import { MAX_BOUND_PURCHASES_PER_USER } from "../subscriptions/limits";
import { AppStoreProductType, isValidState } from "./shared";

type RecheckedStore = "amazon" | "horizon";

/** The user's bound Amazon and Horizon rows, at most `limit` per store. */
export async function recheckedBoundPurchases(
  ctx: QueryCtx,
  projectId: Id<"projects">,
  userId: string,
  limit: number,
): Promise<Doc<"purchases">[]> {
  const perStore = await Promise.all(
    (["amazon", "horizon"] as const).map((store) =>
      ctx.db
        .query("purchases")
        .withIndex("by_project_and_app_user_and_store", (q) =>
          q
            .eq("projectId", projectId)
            .eq("appUserId", userId)
            .eq("store", store),
        )
        .take(limit),
    ),
  );
  return perStore.flat();
}

export async function makePurchaseBindingRoom(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  userId: string,
  store: RecheckedStore,
  remoteId: string,
): Promise<boolean> {
  const bound = await recheckedBoundPurchases(
    ctx,
    projectId,
    userId,
    MAX_BOUND_PURCHASES_PER_USER,
  );
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

/** The `remoteId` of the purchase row a subscription mirrors. */
export function subscriptionPurchaseRemoteId(
  sub: Pick<Doc<"subscriptions">, "store" | "purchaseToken">,
): string | undefined {
  if (sub.store !== "amazon") return sub.purchaseToken;
  const prefix = amazonSubscriptionToken("");
  return sub.purchaseToken.startsWith(prefix)
    ? sub.purchaseToken.slice(prefix.length)
    : undefined;
}

/** "limit" is the bound-purchase cap; "refused" covers every other refusal. */
export async function bindAmazonPurchaseOwner(
  ctx: MutationCtx,
  project: Doc<"projects">,
  sub: Doc<"subscriptions">,
  userId: string,
  allowRebind = false,
): Promise<"linked" | "refused" | "limit"> {
  if (sub.store !== "amazon") return "linked";
  const remoteId = subscriptionPurchaseRemoteId(sub);
  if (remoteId === undefined) return "refused";
  const purchase = await ctx.db
    .query("purchases")
    .withIndex("by_project_and_remote", (q) =>
      q.eq("projectId", project._id).eq("remoteId", remoteId),
    )
    .filter((q) => q.eq(q.field("store"), "amazon"))
    .unique();
  if (!purchase) return "refused";
  if (purchase.appUserId && purchase.appUserId !== userId) {
    if (
      !allowRebind ||
      (await isUserErasureRequested(ctx, project, purchase.appUserId))
    )
      return "refused";
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
    return "limit";
  await ctx.db.patch(purchase._id, {
    appUserId: userId,
    accountErased: undefined,
  });
  return "linked";
}

// Apple and Google one-time purchases have no subscription row, so a server
// links the verified purchase row instead. Auto-renewing purchases link through
// their subscription row and are never matched here.
async function findOneTimeStorePurchase(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  purchaseToken: string,
): Promise<Doc<"purchases"> | null> {
  for (const store of ["apple", "google"] as const) {
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_project_and_remote", (q) =>
        q.eq("projectId", projectId).eq("remoteId", purchaseToken),
      )
      .filter((q) => q.eq(q.field("store"), store))
      .first();
    if (purchase) return isOneTimePurchase(purchase) ? purchase : null;
  }
  return null;
}

// Reads the stored store response: Apple's transaction type, or Google's
// productsv2 shape. Anything unreadable is not linked.
function isOneTimePurchase(purchase: Doc<"purchases">): boolean {
  let response: unknown;
  try {
    response = JSON.parse(purchase.remoteResponse ?? "");
  } catch {
    return false;
  }
  if (!response || typeof response !== "object") return false;
  if (purchase.store === "google") return "productLineItem" in response;
  const type = (response as { type?: unknown }).type;
  return (
    typeof type === "string" &&
    (type as AppStoreProductType) !==
      AppStoreProductType.AUTO_RENEWABLE_SUBSCRIPTION
  );
}

// Any state verify calls valid links, including Google's PENDING_ACKNOWLEDGMENT:
// apps confirm with their backend before finishTransaction acknowledges it.
// These links never grant entitlements, so consumables may link too.
function isLinkable(purchase: Doc<"purchases">): boolean {
  return (
    isValidState(purchase.state) &&
    purchase.isValid === true &&
    Boolean(purchase.productId)
  );
}

/** Links a verified Apple or Google one-time purchase; never moves an owner. */
export async function bindOneTimePurchaseToUser(
  ctx: MutationCtx,
  project: Doc<"projects">,
  purchaseToken: string,
  userId: string,
): Promise<BindOutcome> {
  if (await isUserErasureRequested(ctx, project, userId))
    return { reason: "not_bindable" };
  const purchase = await findOneTimeStorePurchase(
    ctx,
    project._id,
    purchaseToken,
  );
  if (!purchase) return { reason: "not_found" };
  const target = {
    store: purchase.store,
    remoteId: purchaseToken,
    ...(purchase.productId ? { productId: purchase.productId } : {}),
  };
  if (purchase.appUserId === userId)
    return { reason: "already_bound", ...target };
  if (purchase.appUserId) return { reason: "bound_to_other_user", ...target };
  if (!isLinkable(purchase)) return { reason: "not_bindable", ...target };
  // Erasure only unlinked the previous owner; this is a new association.
  await ctx.db.patch(purchase._id, {
    appUserId: userId,
    accountErased: undefined,
  });
  return { reason: "bound", ...target };
}

/** Moves an Apple or Google one-time purchase link. Secret-key callers only. */
export async function rebindOneTimePurchaseToUser(
  ctx: MutationCtx,
  project: Doc<"projects">,
  purchaseToken: string,
  userId: string,
): Promise<{ moved: boolean } | null> {
  if (await isUserErasureRequested(ctx, project, userId)) return null;
  const purchase = await findOneTimeStorePurchase(
    ctx,
    project._id,
    purchaseToken,
  );
  if (!purchase || !isLinkable(purchase)) return null;
  if (purchase.appUserId === userId) return { moved: false };
  if (
    purchase.appUserId &&
    (await isUserErasureRequested(ctx, project, purchase.appUserId))
  )
    return null;
  await ctx.db.patch(purchase._id, {
    appUserId: userId,
    accountErased: undefined,
  });
  return { moved: true };
}
