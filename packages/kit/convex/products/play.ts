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
    // Wrap the parse so a malformed JSON upload yields an actionable
    // config error ("Service account JSON is invalid") instead of a
    // raw SyntaxError from JSON.parse, which surfaces as a generic
    // 500 with no operator-friendly hint.
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(fileContent.content) as Record<string, unknown>;
    } catch {
      throw new Error(
        "Service account JSON is invalid — re-upload the file from Google Cloud Console",
      );
    }

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
          // Defensive filter: `inappproducts.list` is documented to
          // return one-time products only, but the response schema
          // still surfaces a `purchaseType` field that includes
          // "subscription". If a Play instance ever returns a
          // subscription from this endpoint we must skip it — the
          // subscription pull loop below handles those, and routing
          // them through `mapPlayOneTimeType` would mis-classify them
          // as `NonConsumable`.
          if (product.purchaseType === "subscription") continue;
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
            // Reject subscription creates that would land on Play with
            // no base plan: such a subscription is created in a draft
            // state that the Play app cannot purchase, which silently
            // breaks the SDK's `requestPurchase` flow downstream. The
            // operator must provide both a price and currency at
            // minimum so we can synthesize a base plan.
            if (!row.priceAmountMicros || !row.currency) {
              throw new Error(
                "Subscription requires priceAmountMicros + currency to mint a Play base plan; otherwise the product will not be purchasable.",
              );
            }
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
                // Minimal auto-renewing monthly base plan. Operators
                // can edit pricing and offers in Play Console after
                // the initial sync — this only ensures the product
                // is in a purchasable state.
                basePlans: [
                  {
                    basePlanId: "monthly",
                    state: "ACTIVE",
                    autoRenewingBasePlanType: {
                      billingPeriodDuration: "P1M",
                    },
                    regionalConfigs: [
                      {
                        regionCode: "US",
                        price: {
                          currencyCode: row.currency,
                          units: String(
                            Math.trunc(row.priceAmountMicros / 1_000_000),
                          ),
                          nanos: (row.priceAmountMicros % 1_000_000) * 1_000,
                        },
                      },
                    ],
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
                // Play API uses `managedUser` for both consumable and
                // non-consumable; the difference is consumed at
                // purchase time via `consumeAsync`. Subscriptions go
                // through `monetization.subscriptions.*` (see branch
                // above), not this endpoint.
                purchaseType: "managedUser",
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
  // Google's `Money` proto: `units` is a BigInt-as-string. Do the
  // micros multiplication in BigInt to avoid precision loss for
  // large currency values (>2^53). PR #124 review fix.
  try {
    const microsBigInt =
      BigInt(recurring.units) * 1_000_000n +
      BigInt(Math.round((recurring.nanos ?? 0) / 1_000));
    return Number(microsBigInt);
  } catch {
    return undefined;
  }
}

function parseSubBasePlanCurrency(
  sub: androidpublisher_v3.Schema$Subscription,
): string | undefined {
  return (
    sub.basePlans?.[0]?.regionalConfigs?.[0]?.price?.currencyCode ?? undefined
  );
}
