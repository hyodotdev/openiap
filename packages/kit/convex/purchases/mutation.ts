import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { createError, ErrorCode } from "../utils/errors";
import { HarmonizedPurchaseState } from "./purchaseState";
import { applyPurchaseStatsDelta, deltaForUpdate } from "./stats";
import { getProjectById } from "../projects/helpers";

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
