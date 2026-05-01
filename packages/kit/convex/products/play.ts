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
      // One-time products. Play has TWO catalog APIs and apps live in
      // different ones depending on when/how they were set up:
      //
      //   - `inappproducts.list` — legacy v1 endpoint. Apps created
      //     before the new monetization framework store products here.
      //   - `monetization.onetimeproducts.list` — new endpoint. Apps
      //     onboarded under "Manage products" in the modern Play
      //     Console store products HERE and `inappproducts.list`
      //     silently returns empty for them. (This is why "Sync with
      //     Play Console" was only pulling subscriptions for accounts
      //     using the new console — the one-time products were
      //     invisible to the legacy endpoint.)
      //
      // We hit both, dedupe by SKU, and keep going on either failing
      // — that way an account that lives entirely in one or the other
      // still gets a complete pull instead of failing on the missing
      // half.
      const seenOneTimeSkus = new Set<string>();
      try {
        let token: string | undefined;
        let pageCount = 0;
        do {
          const oneTimes = await androidpublisher.inappproducts.list({
            packageName,
            ...(token ? { token } : {}),
          });
          for (const product of oneTimes.data.inappproduct ?? []) {
            if (!product.sku) continue;
            if (seenOneTimeSkus.has(product.sku)) continue;
            seenOneTimeSkus.add(product.sku);
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
          token = oneTimes.data.tokenPagination?.nextPageToken ?? undefined;
          pageCount += 1;
          if (pageCount > 50) break;
        } while (token);
      } catch (error) {
        failures.push({
          productId: "(play list inappproducts)",
          reason: error instanceof Error ? error.message : String(error),
        });
      }

      // New monetization API for one-time products. The googleapis
      // SDK exposes this as `monetization.onetimeproducts.list`. We
      // probe via dynamic access because older versions of the SDK
      // don't have the typings yet — falling back gracefully if the
      // method isn't there keeps kit working with whatever
      // googleapis version is bundled.
      try {
        const onetime = (
          androidpublisher.monetization as unknown as {
            onetimeproducts?: {
              list: (params: {
                packageName: string;
                pageToken?: string;
              }) => Promise<{
                data: {
                  oneTimeProducts?: Array<{
                    productId?: string;
                    listings?: Array<{
                      languageCode?: string;
                      title?: string;
                      description?: string;
                    }>;
                    purchaseOptions?: Array<{
                      buyOption?: {
                        legacyCompatible?: boolean;
                        regionalPricingAndAvailabilityConfigs?: Array<{
                          regionCode?: string;
                          price?: {
                            currencyCode?: string;
                            units?: string;
                            nanos?: number;
                          };
                        }>;
                      };
                      rentOption?: unknown;
                    }>;
                  }>;
                  nextPageToken?: string;
                };
              }>;
            };
          }
        ).onetimeproducts;
        if (onetime?.list) {
          let token: string | undefined;
          let pageCount = 0;
          do {
            const resp = await onetime.list({
              packageName,
              ...(token ? { pageToken: token } : {}),
            });
            for (const product of resp.data.oneTimeProducts ?? []) {
              if (!product.productId) continue;
              if (seenOneTimeSkus.has(product.productId)) continue;
              seenOneTimeSkus.add(product.productId);
              const listing = product.listings?.[0];
              const buyOption = product.purchaseOptions?.[0]?.buyOption;
              const regional =
                buyOption?.regionalPricingAndAvailabilityConfigs ?? [];
              const priceCandidates = regional
                .map((r) => r.price)
                .filter(
                  (p): p is NonNullable<typeof p> =>
                    !!p && typeof p.units === "string",
                );
              const preferred =
                priceCandidates.find((p) => p.currencyCode === "USD") ??
                priceCandidates[0];
              const priceAmountMicros = preferred
                ? moneyToMicros({
                    units: preferred.units,
                    nanos: preferred.nanos,
                  })
                : undefined;
              await ctx.runMutation(internal.products.sync.upsertFromStore, {
                projectId: project._id,
                productId: product.productId,
                platform: "Android",
                // The new API doesn't carry a "consumable vs.
                // non-consumable" distinction the same way — Play
                // tracks consumption at purchase time. Default to
                // NonConsumable; operators can edit on the kit side.
                type: "NonConsumable",
                title: listing?.title ?? product.productId,
                description: listing?.description ?? undefined,
                priceAmountMicros,
                currency: preferred?.currencyCode ?? undefined,
                storeRef: product.productId,
                state: "Active",
              });
              pulled += 1;
            }
            token = resp.data.nextPageToken ?? undefined;
            pageCount += 1;
            if (pageCount > 50) break;
          } while (token);
        }
      } catch (error) {
        failures.push({
          productId: "(play list onetimeproducts)",
          reason: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        let token: string | undefined;
        let pageCount = 0;
        do {
          const subs = await androidpublisher.monetization.subscriptions.list({
            packageName,
            ...(token ? { pageToken: token } : {}),
          });
          for (const sub of subs.data.subscriptions ?? []) {
            if (!sub.productId) continue;
            const { priceAmountMicros, currency } = pickSubBasePlanPrice(sub);
            await ctx.runMutation(internal.products.sync.upsertFromStore, {
              projectId: project._id,
              productId: sub.productId,
              platform: "Android",
              type: "Subscription",
              title: sub.listings?.[0]?.title ?? sub.productId,
              description: sub.listings?.[0]?.description ?? undefined,
              priceAmountMicros,
              currency,
              storeRef: sub.productId,
              state: "Active",
            });
            pulled += 1;
          }
          token = subs.data.nextPageToken ?? undefined;
          pageCount += 1;
          if (pageCount > 50) break;
        } while (token);
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
                // Auto-renewing base plan. Period from the catalog row;
                // defaults to monthly when the operator hasn't picked
                // one. The base-plan id mirrors the duration so a row
                // upgraded later from monthly→yearly doesn't collide
                // with an existing base plan id in Play Console.
                basePlans: [
                  {
                    basePlanId: basePlanIdForPeriod(row.billingPeriod),
                    state: "ACTIVE",
                    autoRenewingBasePlanType: {
                      billingPeriodDuration: row.billingPeriod ?? "P1M",
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

// Pick a representative price + currency for a subscription. The
// previous implementation had three bugs that combined to produce the
// "wrong currency" / "missing price" output the dashboard surfaced:
//
//   1. It bailed out (returned null price) whenever
//      `legacyCompatibleSubscriptionOfferId` was set on the base plan.
//      That field's presence has nothing to do with whether the plan
//      has pricing — it's a migration shim from the static-pricing era
//      — so any sub configured with that compat id silently lost its
//      price. (Hence the second product showing "—" in the screenshot.)
//   2. It always read `regionalConfigs?.[0]`, which is just whichever
//      region Google sorted first. That made the UI flip between AED /
//      USD / KRW depending on the response order.
//   3. Currency and price were read independently and could disagree.
//
// New rule: walk every basePlan, walk every regionalConfig, prefer USD
// if any region offers it, otherwise return the first region with a
// readable price. Currency + price come from the SAME regionalConfig
// so they're always consistent.
function pickSubBasePlanPrice(sub: androidpublisher_v3.Schema$Subscription): {
  priceAmountMicros?: number;
  currency?: string;
} {
  const candidates: Array<androidpublisher_v3.Schema$Money> = [];
  for (const plan of sub.basePlans ?? []) {
    for (const region of plan.regionalConfigs ?? []) {
      if (region.price) candidates.push(region.price);
    }
  }
  if (candidates.length === 0) return {};
  // Prefer USD when any region offers it — it's the most universally
  // recognizable in a dashboard. The operator can edit per-region
  // prices in Play Console; this just picks a stable display value.
  const preferred =
    candidates.find((p) => p.currencyCode === "USD") ?? candidates[0];
  return {
    priceAmountMicros: moneyToMicros(preferred),
    currency: preferred.currencyCode ?? undefined,
  };
}

function moneyToMicros(
  money: androidpublisher_v3.Schema$Money | undefined,
): number | undefined {
  if (!money?.units) return undefined;
  // Google's `Money` proto: `units` is a BigInt-as-string. Do the
  // micros multiplication in BigInt to avoid precision loss for
  // large currency values (>2^53). PR #124 review fix.
  try {
    const microsBigInt =
      BigInt(money.units) * 1_000_000n +
      BigInt(Math.round((money.nanos ?? 0) / 1_000));
    return Number(microsBigInt);
  } catch {
    return undefined;
  }
}

// Stable basePlanId per billing period — Play's product detail page
// shows this id, so something descriptive beats "monthly" hardcoded
// for non-monthly billing.
function basePlanIdForPeriod(period: string | undefined): string {
  switch (period) {
    case "P1W":
      return "weekly";
    case "P2M":
      return "bimonthly";
    case "P3M":
      return "quarterly";
    case "P6M":
      return "semiannual";
    case "P1Y":
      return "yearly";
    case "P1M":
    case undefined:
    default:
      return "monthly";
  }
}
