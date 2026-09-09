"use node";

import { verifyGooglePlayReceiptInternalV1 } from "./android";
import {
  verifyAmazonReceiptInternalV1,
  verifyAmazonReceipt as verifyAmazon,
} from "./amazon";
import { verifyAppStoreReceiptInternalV1 } from "./ios";
import { verifyHorizonReceipt } from "./horizon";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import {
  assertEntitlementRecheckAdmission,
  getProjectByApiKey,
} from "./shared";

export const readBoundPurchaseEntitlements = action({
  args: { apiKey: v.string(), userId: v.string() },
  returns: v.object({ productIds: v.array(v.string()) }),
  handler: async (ctx, args): Promise<{ productIds: string[] }> => {
    const project = await getProjectByApiKey(ctx, args.apiKey, "admin");
    const queryArgs = { projectId: project._id, userId: args.userId };
    const purchases = await ctx.runQuery(
      internal.purchases.internal.boundPurchasesForUser,
      queryArgs,
    );
    // One store call per bound purchase, paid up front from the recheck bucket.
    if (purchases.length > 0)
      await assertEntitlementRecheckAdmission(
        ctx,
        project._id,
        purchases.length,
      );
    // A store this pass cannot reach fails the read: the reference
    // implementation answers the same way, so the interop evidence stays
    // comparable. See the note in COMMERCE-EVENTS.md before changing it.
    const rechecked = new Set<Id<"purchases">>();
    for (const purchase of purchases) {
      const evidence = purchase.requestData;
      if (evidence.store === "amazon") {
        await verifyAmazon(
          ctx,
          {
            apiKey: args.apiKey,
            userId: evidence.userId,
            receiptId: evidence.receiptId,
            sandbox: evidence.sandbox,
          },
          { recheck: true },
        );
      } else if (evidence.store === "horizon") {
        await verifyHorizonReceipt(
          ctx,
          { apiKey: args.apiKey, userId: evidence.userId, sku: evidence.sku },
          { recheck: true },
        );
      } else {
        continue;
      }
      rechecked.add(purchase._id);
    }
    // Re-read ownership after the network calls so erasure cannot return stale
    // access, then keep only rows this pass actually reconfirmed. A purchase
    // bound mid-read is absent rather than an error the operation never
    // declares.
    const current = await ctx.runQuery(
      internal.purchases.internal.boundPurchasesForUser,
      queryArgs,
    );
    return {
      productIds: [
        ...new Set(
          current.flatMap((purchase) =>
            rechecked.has(purchase._id) &&
            purchase.isValid &&
            purchase.productId
              ? [purchase.productId]
              : [],
          ),
        ),
      ],
    };
  },
});

export const verifyGooglePlayReceipt = verifyGooglePlayReceiptInternalV1;
export const verifyAppStoreReceipt = verifyAppStoreReceiptInternalV1;
export const verifyAmazonReceipt = verifyAmazonReceiptInternalV1;
