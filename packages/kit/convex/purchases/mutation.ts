import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { createError, ErrorCode } from "../utils/errors";
import { HarmonizedPurchaseState } from "./purchaseState";
import { applyPurchaseStatsDelta, deltaForUpdate } from "./stats";

// Mark purchase as inauthentic
export const markReceiptInvalid = mutation({
  args: {
    purchaseId: v.id("purchases"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get(args.purchaseId);

    if (!purchase) {
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
      updatedAt: Date.now(),
    });

    // `hasOrderId` is unchanged by this patch, but passing it both as
    // the prev and next value keeps `googleOrders` stable when the
    // delta helper is the one source of truth for stats transitions.
    await applyPurchaseStatsDelta(
      ctx,
      purchase.projectId,
      deltaForUpdate(
        purchase.store,
        prevIsValid,
        purchase.store,
        false,
        hasOrderId,
        hasOrderId,
      ),
    );

    return args.purchaseId;
  },
});
