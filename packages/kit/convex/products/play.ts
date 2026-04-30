"use node";
import { v } from "convex/values";
import { google } from "googleapis";
import type { androidpublisher_v3 } from "googleapis";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { getProjectByApiKey } from "../purchases/shared";

// Google Play Developer API client + push-sync action.
//
// Auth: reuses the same per-project service-account JSON kit already
// stores for receipt verification (see `convex/purchases/android.ts`).
// The googleapis SDK handles OAuth token minting.
//
// Surface area:
//   - inappproducts.list   → kit ← Play one-time products
//   - inappproducts.get
//   - inappproducts.insert → kit → Play (create new)
//   - inappproducts.patch  → kit → Play (update existing)
//   - monetization.subscriptions.list/insert → subscription products
// The `pushSyncProductsGoogle` action drives both directions.

export const pushSyncProductsGoogle = action({
  args: {
    apiKey: v.string(),
    direction: v.optional(
      v.union(v.literal("pull"), v.literal("push"), v.literal("both")),
    ),
  },
  returns: v.object({
    pulled: v.number(),
    pushed: v.number(),
    failures: v.array(v.object({ productId: v.string(), reason: v.string() })),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    pulled: number;
    pushed: number;
    failures: Array<{ productId: string; reason: string }>;
  }> => {
    const project = await getProjectByApiKey(ctx, args.apiKey);
    if (!project.androidPackageName) {
      throw new Error("Project androidPackageName is not configured");
    }

    const serviceAccountFile = await ctx.runQuery(
      internal.files.internal.getGooglePlayFileByProjectInternal,
      { projectId: project._id },
    );
    if (!serviceAccountFile) {
      throw new Error(
        "Google Play service account JSON not found — upload it before running push-sync",
      );
    }
    const fileContent = await ctx.runAction(
      internal.files.internal.readFileAsText,
      { fileId: serviceAccountFile._id },
    );
    if (!fileContent?.content) {
      throw new Error("Service account JSON file is unreadable");
    }
    const credentials = JSON.parse(fileContent.content);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const androidpublisher = google.androidpublisher({ version: "v3", auth });
    const packageName = project.androidPackageName;
    const direction = args.direction ?? "both";
    const failures: Array<{ productId: string; reason: string }> = [];
    let pulled = 0;
    let pushed = 0;

    // ── PULL: Play → kit ─────────────────────────────────────────
    if (direction === "pull" || direction === "both") {
      try {
        const oneTimes = await androidpublisher.inappproducts.list({
          packageName,
        });
        for (const product of oneTimes.data.inappproduct ?? []) {
          if (!product.sku) continue;
          await ctx.runMutation(internal.products.sync.upsertFromStore, {
            projectId: project._id,
            productId: product.sku,
            platform: "Android",
            type: mapPlayOneTimeType(product),
            title: pickPlayTitle(product) ?? product.sku,
            description: pickPlayDescription(product),
            priceAmountMicros: parsePlayPriceMicros(product),
            currency: pickPlayCurrency(product),
            storeRef: product.sku,
            state: mapPlayStatus(product.status),
          });
          pulled += 1;
        }
      } catch (error) {
        failures.push({
          productId: "(play list inappproducts)",
          reason: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        const subs = await androidpublisher.monetization.subscriptions.list({
          packageName,
        });
        for (const sub of subs.data.subscriptions ?? []) {
          if (!sub.productId) continue;
          await ctx.runMutation(internal.products.sync.upsertFromStore, {
            projectId: project._id,
            productId: sub.productId,
            platform: "Android",
            type: "Subscription",
            title: sub.listings?.[0]?.title ?? sub.productId,
            description: sub.listings?.[0]?.description ?? undefined,
            priceAmountMicros: parseSubBasePlanPriceMicros(sub),
            currency: parseSubBasePlanCurrency(sub),
            storeRef: sub.productId,
            state: "Active",
          });
          pulled += 1;
        }
      } catch (error) {
        failures.push({
          productId: "(play list subscriptions)",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // ── PUSH: kit → Play for Draft rows ──────────────────────────
    if (direction === "push" || direction === "both") {
      const drafts = await ctx.runQuery(
        internal.products.sync.listDraftAndroidProducts,
        { projectId: project._id },
      );
      for (const row of drafts) {
        try {
          if (row.type === "Subscription") {
            await androidpublisher.monetization.subscriptions.create({
              packageName,
              requestBody: {
                productId: row.productId,
                listings: [
                  {
                    languageCode: "en-US",
                    title: row.title,
                    description: row.description ?? row.title,
                  },
                ],
              },
            });
          } else {
            await androidpublisher.inappproducts.insert({
              packageName,
              requestBody: {
                packageName,
                sku: row.productId,
                purchaseType:
                  row.type === "Consumable" ? "managedUser" : "managedUser",
                status: "active",
                defaultLanguage: "en-US",
                listings: {
                  "en-US": {
                    title: row.title,
                    description: row.description ?? row.title,
                  },
                },
                ...(row.priceAmountMicros && row.currency
                  ? {
                      defaultPrice: {
                        priceMicros: String(row.priceAmountMicros),
                        currency: row.currency,
                      },
                    }
                  : {}),
              },
            });
          }
          await ctx.runMutation(internal.products.sync.markPushed, {
            projectId: project._id,
            productId: row.productId,
            platform: "Android",
            storeRef: row.productId,
          });
          pushed += 1;
        } catch (error) {
          failures.push({
            productId: row.productId,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return { pulled, pushed, failures };
  },
});

function mapPlayOneTimeType(
  product: androidpublisher_v3.Schema$InAppProduct,
): "Subscription" | "NonConsumable" | "Consumable" {
  if (product.purchaseType === "managedUser") return "NonConsumable";
  return "Consumable";
}

function mapPlayStatus(
  status: string | null | undefined,
): "Draft" | "Ready" | "Active" | "Removed" {
  switch (status) {
    case "active":
      return "Active";
    case "inactive":
      return "Removed";
    default:
      return "Draft";
  }
}

function pickPlayTitle(
  product: androidpublisher_v3.Schema$InAppProduct,
): string | undefined {
  const def = product.defaultLanguage ?? "en-US";
  return product.listings?.[def]?.title ?? undefined;
}

function pickPlayDescription(
  product: androidpublisher_v3.Schema$InAppProduct,
): string | undefined {
  const def = product.defaultLanguage ?? "en-US";
  return product.listings?.[def]?.description ?? undefined;
}

function parsePlayPriceMicros(
  product: androidpublisher_v3.Schema$InAppProduct,
): number | undefined {
  const raw = product.defaultPrice?.priceMicros;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function pickPlayCurrency(
  product: androidpublisher_v3.Schema$InAppProduct,
): string | undefined {
  return product.defaultPrice?.currency ?? undefined;
}

function parseSubBasePlanPriceMicros(
  sub: androidpublisher_v3.Schema$Subscription,
): number | undefined {
  const recurring =
    sub.basePlans?.[0]?.autoRenewingBasePlanType
      ?.legacyCompatibleSubscriptionOfferId !== undefined
      ? null
      : sub.basePlans?.[0]?.regionalConfigs?.[0]?.price;
  if (!recurring?.units) return undefined;
  const units = Number(recurring.units);
  const nanos = recurring.nanos ?? 0;
  if (!Number.isFinite(units)) return undefined;
  return units * 1_000_000 + Math.round(nanos / 1_000);
}

function parseSubBasePlanCurrency(
  sub: androidpublisher_v3.Schema$Subscription,
): string | undefined {
  return (
    sub.basePlans?.[0]?.regionalConfigs?.[0]?.price?.currencyCode ?? undefined
  );
}
