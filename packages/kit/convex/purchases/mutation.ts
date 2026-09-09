import { internalMutation, mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import {
  isValidSubscriptionUserId,
  MAX_BOUND_PURCHASES_PER_USER,
} from "../subscriptions/limits";
import { isUserErasureRequested } from "../subscriptions/erasure";

import { createError, ErrorCode } from "../utils/errors";
import { HarmonizedPurchaseState } from "./purchaseState";
import {
  applyPurchaseStatsDelta,
  deltaForMissingPurchaseStats,
  deltaForUpdate,
  mergePurchaseStatsDeltas,
} from "./stats";
import { getProjectById } from "../projects/helpers";

export const bindVerifiedPurchaseAsServer = mutation({
  args: {
    apiKey: v.string(),
    userId: v.string(),
    store: v.union(v.literal("amazon"), v.literal("horizon")),
    remoteId: v.string(),
  },
  returns: v.object({ bound: v.boolean() }),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByApiKeyFromDb(
      ctx,
      args.apiKey,
      "admin",
    );
    if (!resolved)
      throw new ConvexError({
        code: "INVALID_API_KEY",
        message: "Invalid credential",
      });
    if (
      !isValidSubscriptionUserId(args.userId) ||
      !args.remoteId ||
      args.remoteId.length > 65536
    )
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Invalid purchase identity",
      });
    if (await isUserErasureRequested(ctx, resolved.project, args.userId))
      return { bound: false };
    // The cap is decided from the caller's own rows before any evidence lookup,
    // so neither the answer nor the log depends on someone else's purchase.
    const bound = await ctx.db
      .query("purchases")
      .withIndex("by_project_and_app_user", (q) =>
        q.eq("projectId", resolved.project._id).eq("appUserId", args.userId),
      )
      .take(MAX_BOUND_PURCHASES_PER_USER);
    if (bound.length >= MAX_BOUND_PURCHASES_PER_USER) {
      if (
        bound.some(
          (row) => row.store === args.store && row.remoteId === args.remoteId,
        )
      )
        return { bound: true };
      // SPEC §4.4 keeps every non-binding outcome at bound:false, so the cap
      // is visible to operators only through this log line.
      console.warn("[commerce] bindPurchase refused: bound purchase limit", {
        projectId: resolved.project._id,
        store: args.store,
      });
      return { bound: false };
    }
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_project_and_remote", (q) =>
        q.eq("projectId", resolved.project._id).eq("remoteId", args.remoteId),
      )
      .filter((q) => q.eq(q.field("store"), args.store))
      .unique();
    if (!purchase) return { bound: false };
    if (purchase.appUserId)
      return { bound: purchase.appUserId === args.userId };
    // Only a currently entitled purchase binds; an Amazon consumable is
    // fulfilled once by the app's own ledger.
    if (
      purchase.state !== HarmonizedPurchaseState.ENTITLED ||
      !purchase.isValid ||
      !purchase.productId
    )
      return { bound: false };
    // Erasure only unlinked the previous owner; this is a new association.
    await ctx.db.patch(purchase._id, {
      appUserId: args.userId,
      accountErased: undefined,
    });
    return { bound: true };
  },
});
// Mark purchase as inauthentic.
//
// Internal-only on purpose: nothing in the dashboard or server calls this —
// it is an operator/maintenance function (run it from the Convex dashboard).
// As a public mutation it took only a `purchaseId` and performed no
// identity/membership check, so anyone reaching the deployment could flip
// another tenant's receipt to INAUTHENTIC and skew its purchase stats.
// It stays in this file (rather than internal.ts) to keep the generated
// module graph unchanged; see packages/kit/CONVENTION.md for the CQRS split.
export const markReceiptInvalid = internalMutation({
  args: {
    purchaseId: v.id("purchases"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get(args.purchaseId);

    if (!purchase) {
      throw createError(ErrorCode.RECEIPT_NOT_FOUND);
    }
    const project = await getProjectById(ctx, purchase.projectId);
    if (!project) {
      throw createError(ErrorCode.RECEIPT_NOT_FOUND);
    }

    const prevIsValid = purchase.isValid ?? false;
    // Treat empty strings as absent so we stay aligned with the
    // extractor and backfill contract — an empty `orderId` never
    // represents a real Google order, and feeding it to
    // `deltaForUpdate` as "present" would mis-decrement
    // `googleOrders` if any malformed rows ever reached this path.
    const hasOrderId =
      typeof purchase.orderId === "string" && purchase.orderId.length > 0;

    await ctx.db.patch(args.purchaseId, {
      state: HarmonizedPurchaseState.INAUTHENTIC,
      isValid: false,
      statsCounted: true,
      storeStatsCounted: true,
      updatedAt: Date.now(),
      // Same reasoning as the recheck lane: an Amazon receipt marked invalid is
      // dead, so it must not keep occupying the account's bind cap.
      ...(purchase.store === "amazon" ? { appUserId: undefined } : {}),
    });

    // `hasOrderId` is unchanged by this patch, but passing it both as
    // the prev and next value keeps `googleOrders` stable when the
    // delta helper is the one source of truth for stats transitions.
    await applyPurchaseStatsDelta(
      ctx,
      purchase.projectId,
      mergePurchaseStatsDeltas(
        deltaForMissingPurchaseStats(
          purchase.store,
          prevIsValid,
          hasOrderId,
          purchase.statsCounted === true,
          purchase.storeStatsCounted === true,
        ),
        deltaForUpdate(
          purchase.store,
          prevIsValid,
          purchase.store,
          false,
          hasOrderId,
          hasOrderId,
        ),
      ),
    );

    return args.purchaseId;
  },
});
