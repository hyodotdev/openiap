import { internalMutation, mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { resolveProjectByApiKeyFromDb } from "../projects/helpers";
import { isValidSubscriptionUserId } from "../subscriptions/limits";
import { isUserErasureRequested } from "../subscriptions/erasure";

import {
  amazonSubscriptionToken,
  syncAmazonSubscription,
} from "../subscriptions/amazon";
import {
  bindSubscriptionToUserHandler,
  findSubscriptionByToken,
} from "../subscriptions/internal";
import { createError, ErrorCode } from "../utils/errors";
import { HarmonizedPurchaseState } from "./purchaseState";
import {
  applyPurchaseStatsDelta,
  deltaForMissingPurchaseStats,
  deltaForUpdate,
  mergePurchaseStatsDeltas,
} from "./stats";
import { getProjectById } from "../projects/helpers";
import { reserveAmazonRvsSequenceHandler } from "./internal";
import { makePurchaseBindingRoom } from "./binding";
import { recordBindIssue } from "../purchaseIssues/internal";

export const bindVerifiedPurchaseAsServer = mutation({
  args: {
    apiKey: v.string(),
    userId: v.string(),
    store: v.union(v.literal("amazon"), v.literal("horizon")),
    remoteId: v.string(),
    // SHA-256 of the evidence, for issue records only.
    evidenceFingerprint: v.optional(v.string()),
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
    const issueRequest = {
      purchaseToken: args.remoteId,
      userId: args.userId,
      evidenceFingerprint: args.evidenceFingerprint,
    };
    // The cap is decided from the caller's own rows before any evidence lookup,
    // so neither the answer nor the log depends on someone else's purchase.
    if (
      !(await makePurchaseBindingRoom(
        ctx,
        resolved.project._id,
        args.userId,
        args.store,
        args.remoteId,
      ))
    ) {
      await recordBindIssue(
        ctx,
        resolved.project._id,
        { reason: "not_bindable", limitReached: true, store: args.store },
        issueRequest,
      );
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
    if (purchase.appUserId && purchase.appUserId !== args.userId) {
      await recordBindIssue(
        ctx,
        resolved.project._id,
        {
          reason: "bound_to_other_user",
          store: args.store,
          productId: purchase.productId,
        },
        issueRequest,
      );
      return { bound: false };
    }
    // Only a currently entitled purchase binds; an Amazon consumable is
    // fulfilled once by the app's own ledger.
    if (
      purchase.state !== HarmonizedPurchaseState.ENTITLED ||
      !purchase.isValid ||
      !purchase.productId
    )
      return { bound: purchase.appUserId === args.userId };
    if (args.store === "amazon") {
      const sub = await findSubscriptionByToken(
        ctx,
        purchase.projectId,
        amazonSubscriptionToken(args.remoteId),
      );
      if (
        sub &&
        !(await bindSubscriptionToUserHandler(ctx, {
          projectId: purchase.projectId,
          purchaseToken: sub.purchaseToken,
          userId: args.userId,
        }))
      )
        return { bound: false };
    }
    // Erasure only unlinked the previous owner; this is a new association.
    await ctx.db.patch(purchase._id, {
      appUserId: args.userId,
      accountErased: undefined,
    });
    return { bound: true };
  },
});
// Marks a purchase inauthentic. Operator-only, run from the Convex dashboard.
// Internal because it takes only a purchaseId with no membership check: public,
// it would let anyone flip another tenant's receipt. It stays in mutation.ts
// to keep its generated path, the exception packages/kit/CONVENTION.md allows.
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
    // An empty orderId is not an order (as in the extractor and backfill);
    // counting it would skew googleOrders.
    const hasOrderId =
      typeof purchase.orderId === "string" && purchase.orderId.length > 0;

    const amazonRvsSequence =
      purchase.store === "amazon"
        ? await reserveAmazonRvsSequenceHandler(ctx, {
            projectId: purchase.projectId,
          })
        : undefined;
    await ctx.db.patch(args.purchaseId, {
      state: HarmonizedPurchaseState.INAUTHENTIC,
      isValid: false,
      statsCounted: true,
      storeStatsCounted: true,
      updatedAt: Date.now(),
      ...(amazonRvsSequence !== undefined
        ? { lastAmazonRvsSequence: amazonRvsSequence }
        : {}),
    });

    if (purchase.store === "amazon") {
      const invalid = await ctx.db.get(purchase._id);
      if (!invalid)
        throw new Error("Amazon purchase disappeared during invalidation");
      await syncAmazonSubscription(ctx, invalid);
    }

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
