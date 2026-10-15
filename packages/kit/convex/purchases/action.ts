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
    // Apple and Google one-time links (secret-key /v1 bind-user) are for
    // attribution: IAPKit cannot recheck them, so they never grant here.
    const purchases = (
      await ctx.runQuery(
        internal.purchases.internal.boundPurchasesForUser,
        queryArgs,
      )
    ).flatMap(({ _id, requestData: evidence }) =>
      evidence.store === "amazon" || evidence.store === "horizon"
        ? [{ _id, evidence }]
        : [],
    );
    // One store call per bound purchase, paid up front from the recheck bucket.
    if (purchases.length > 0)
      await assertEntitlementRecheckAdmission(
        ctx,
        project._id,
        purchases.length,
      );
    // A store this pass cannot reach fails the read, including when the project
    // has since disabled it: the rows it granted are still bound and still
    // valid, so omitting them would be the partial answer SPEC "Fail-close"
    // forbids. Re-enabling the store is the way back: this throw happens before
    // anything can mark those rows invalid, so nothing else releases them.
    const rechecked = new Set<Id<"purchases">>();
    for (const { _id, evidence } of purchases) {
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
      } else {
        await verifyHorizonReceipt(
          ctx,
          { apiKey: args.apiKey, userId: evidence.userId, sku: evidence.sku },
          { recheck: true },
        );
      }
      rechecked.add(_id);
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
