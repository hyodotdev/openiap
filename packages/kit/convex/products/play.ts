"use node";
import { v } from "convex/values";
import { google } from "googleapis";
import type { androidpublisher_v3 } from "googleapis";

import { internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  BASE_LISTING_LOCALE,
  listingRowsForProduct,
  splitStoreListings,
  type ProductLocalization,
} from "./localizations";
import type { ProductRegions } from "./regions";
import { coerceBillingPeriod } from "./sync";

type GoogleAuthClient = InstanceType<typeof google.auth.GoogleAuth>;

class ProductSyncCancelledError extends Error {
  constructor() {
    super("Sync cancelled by operator");
    this.name = "ProductSyncCancelledError";
  }
}

/** Per-product upstream rejection shown on the dashboard. */
export interface ProductSyncFailure {
  productId: string;
  reason: string;
}

// Google Play catalog sync through the Android Publisher API. Auth reuses the
// project's service-account JSON from receipt verification
// (`convex/purchases/android.ts`); googleapis mints the OAuth tokens.

/**
 * Runs one Google Play sync job, with the same lifecycle and phase-boundary
 * cancellation as `runProductSyncIOS` in `products/asc.ts`.
 *
 * `pull` imports every Play IAP and subscription, `push` sends kit's Draft
 * rows to Play, and `both` pulls, then pushes. The catalog is walked
 * sequentially: under ~100 SKUs fits Convex's 10-minute action limit easily;
 * over ~500 may need a batched, scheduler-chained variant.
 */
export const runProductSyncAndroid = internalAction({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(internal.products.jobs.getJobForWorker, {
      jobId: args.jobId,
    });
    if (!job) return;
    if (job.status !== "queued") return;
    await ctx.runMutation(internal.products.jobs.markJobRunning, {
      jobId: args.jobId,
    });
    const checkCancelled = async () => {
      const cancelled = await ctx.runQuery(
        internal.products.jobs.isCancelRequested,
        { jobId: args.jobId },
      );
      if (cancelled) throw new ProductSyncCancelledError();
    };
    const reportPhase = async (
      phase: string,
      extra?: {
        current?: number;
        total?: number;
        failuresCount?: number;
      },
    ) => {
      await ctx.runMutation(internal.products.jobs.updateJobProgress, {
        jobId: args.jobId,
        phase,
        current: extra?.current,
        total: extra?.total,
        failuresCount: extra?.failuresCount,
      });
    };
    if (job.direction === "purge-local") {
      // Unreachable (enqueue sends purge-local elsewhere); narrows the type.
      await ctx.runMutation(internal.products.jobs.markJobFailed, {
        jobId: args.jobId,
        error: "purge-local routed to wrong worker",
      });
      return;
    }
    try {
      const result = await performAndroidSync(ctx, {
        projectId: job.projectId,
        direction: job.direction,
        dryRun: job.dryRun,
        checkCancelled,
        reportPhase,
      });
      await ctx.runMutation(internal.products.jobs.markJobSucceeded, {
        jobId: args.jobId,
        pulled: result.pulled,
        pushed: result.pushed,
        deleted: result.deleted,
        failures: result.failures,
        plannedWrites: result.plannedWrites,
        manualActions: result.manualActions,
      });
    } catch (error) {
      const cancelled = error instanceof ProductSyncCancelledError;
      const message = cancelled
        ? "Cancelled by operator"
        : error instanceof Error
          ? error.message
          : String(error);
      await ctx.runMutation(internal.products.jobs.markJobFailed, {
        jobId: args.jobId,
        error: message,
      });
    }
  },
});

// Mirrors the types in `products/asc.ts`. Not shared: importing from a
// "use node" module into a non-node one would pull googleapis into the V8
// isolate.
interface AndroidSyncProgressUpdate {
  current?: number;
  total?: number;
  failuresCount?: number;
}
interface AndroidSyncOptions {
  projectId: import("../_generated/dataModel").Id<"projects">;
  direction: "pull" | "push" | "both";
  dryRun: boolean;
  checkCancelled: () => Promise<void>;
  reportPhase: (
    phase: string,
    extra?: AndroidSyncProgressUpdate,
  ) => Promise<void>;
}
interface AndroidSyncResult {
  pulled: number;
  pushed: number;
  deleted?: number;
  failures: ProductSyncFailure[];
  plannedWrites?: Array<{ productId: string; step: string; detail?: string }>;
  // Push succeeded but Play Console still needs a human, like iOS's
  // AscManualReviewAction (#288: prices that could not be converted leave the
  // product US-only until the operator sets them).
  manualActions?: AndroidManualAction[];
}

interface AndroidManualAction {
  productId: string;
  code:
    | "regional_pricing_incomplete"
    | "regional_expansion_available"
    | "product_type_assumed";
  message: string;
}

async function performAndroidSync(
  ctx: ActionCtx,
  options: AndroidSyncOptions,
): Promise<AndroidSyncResult> {
  const project = await ctx.runQuery(
    internal.projects.internal.getProjectById,
    { projectId: options.projectId },
  );
  if (!project) {
    throw new Error("Project not found for sync job");
  }
  if (!project.androidPackageName) {
    throw new Error("Project androidPackageName is not configured");
  }
  const args = { direction: options.direction };
  const { checkCancelled, reportPhase } = options;

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
  // A raw SyntaxError would surface as a generic 500 with no hint.
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
  const dryRun = options.dryRun;
  const failures: ProductSyncFailure[] = [];
  // Dry-run preview: each write the push would make, shown to the operator
  // (base-plan duration, region pricing, ...) before committing.
  const plannedWrites: Array<{
    productId: string;
    step: string;
    detail?: string;
  }> = [];
  const manualActions: AndroidManualAction[] = [];
  let pulled = 0;
  let pushed = 0;
  let deleted = 0;

  // ── PULL: Play → kit ─────────────────────────────────────────
  if (direction === "pull" || direction === "both") {
    await checkCancelled();
    await reportPhase("pull-products");
    // Play keeps one-time products in two APIs. Legacy `inappproducts.list`
    // returns empty for apps set up under the modern console's "Manage
    // products"; those live in `monetization.onetimeproducts.list`. Query both,
    // dedupe by SKU, and keep going if either fails.
    // The new API runs first so its USD-preferred regional price wins; legacy
    // has only one `defaultPrice`, in whatever currency the merchant set.
    const seenOneTimeSkus = new Set<string>();
    const existingTypeRows = await ctx.runQuery(
      internal.products.sync.listExistingProductTypes,
      { projectId: project._id, platform: "Android" },
    );
    const existingTypesByProductId = new Map(
      existingTypeRows.map((row) => [row.productId, row.type]),
    );
    const existingCurrencyByProductId = new Map(
      existingTypeRows
        .filter((row) => row.currency)
        .map((row) => [row.productId, row.currency as string]),
    );
    try {
      // googleapis has no typed `onetimeproducts` yet, so read it through
      // `unknown`. If it is missing, skip it and let the legacy pull run; the
      // outer catch records any failure for the operator.
      const monetizationApi = androidpublisher.monetization as
        | { onetimeproducts?: unknown }
        | undefined;
      const onetime = (
        monetizationApi as unknown as {
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
                    state?: string;
                    purchaseOptionId?: string;
                    buyOption?: { legacyCompatible?: boolean };
                    rentOption?: unknown;
                    // Pricing is on the option itself, not inside buyOption.
                    regionalPricingAndAvailabilityConfigs?: Array<{
                      regionCode?: string;
                      // AVAILABLE, NO_LONGER_AVAILABLE, AVAILABLE_IF_RELEASED.
                      // Removed regions still come back with a price attached.
                      availability?: string;
                      price?: {
                        currencyCode?: string;
                        units?: string;
                        nanos?: number;
                      };
                    }>;
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
            // Candidates skip NO_LONGER_AVAILABLE regions (stale prices) and
            // prices without `units` (zero-priced placeholders that would sort
            // ahead of real prices); pickPlayRegionalPrice ranks the rest.
            const priceCandidates: Array<{
              regionCode?: string;
              currencyCode?: string;
              units?: string;
              nanos?: number;
            }> = [];
            for (const opt of product.purchaseOptions ?? []) {
              for (const region of opt.regionalPricingAndAvailabilityConfigs ??
                []) {
                if (region.availability === "NO_LONGER_AVAILABLE") continue;
                if (region.price && typeof region.price.units === "string") {
                  priceCandidates.push({
                    regionCode: region.regionCode,
                    currencyCode: region.price.currencyCode,
                    units: region.price.units,
                    nanos: region.price.nanos,
                  });
                }
              }
            }
            priceCandidates.sort((a, b) =>
              (a.currencyCode ?? "").localeCompare(b.currencyCode ?? ""),
            );
            // Keep the kit row's authored currency; see pickPlayRegionalPrice.
            const authoredCurrency = existingCurrencyByProductId.get(
              product.productId,
            );
            const preferred = pickPlayRegionalPrice(
              priceCandidates,
              authoredCurrency,
            );
            const priceAmountMicros = preferred
              ? moneyToMicros({
                  units: preferred.units,
                  nanos: preferred.nanos,
                })
              : undefined;
            const existingType = existingTypesByProductId.get(
              product.productId,
            );
            if (existingType === undefined) {
              // The modern API has no consumable flag. NonConsumable is the
              // safe guess (consuming a non-consumable destroys an
              // entitlement), but a consumable then verifies as
              // PENDING_ACKNOWLEDGMENT, which clients may read as a rejection
              // (#289), so tell the operator.
              manualActions.push({
                productId: product.productId,
                code: "product_type_assumed",
                message:
                  `Imported "${product.productId}" as NonConsumable — Play's one-time-product API doesn't report whether a product is consumable. ` +
                  `If it is a consumable, set its type in the dashboard; until then it verifies as pending-acknowledgment rather than ready-to-consume.`,
              });
            }
            await ctx.runMutation(internal.products.sync.upsertFromStore, {
              projectId: project._id,
              productId: product.productId,
              platform: "Android",
              // Play tracks consumption per purchase, not per product; keep the
              // kit-authored type so a pull never turns a consumable into a
              // non-consumable.
              type: preservePlayOneTimeType(existingType, "NonConsumable"),
              ...splitStoreListings(
                (product.listings ?? []).map((entry) => ({
                  locale: entry.languageCode,
                  title: entry.title,
                  description: entry.description,
                })),
                product.productId,
              ),
              priceAmountMicros,
              currency: preferred?.currencyCode ?? undefined,
              storeRef: product.productId,
              state: mapModernPlayOneTimeState(product.purchaseOptions),
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

    // Legacy second: it only fills SKUs the new API did not return.
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
          const existingType = existingTypesByProductId.get(product.sku);
          await ctx.runMutation(internal.products.sync.upsertFromStore, {
            projectId: project._id,
            productId: product.sku,
            platform: "Android",
            type: preservePlayOneTimeType(
              existingType,
              mapPlayOneTimeType(product),
            ),
            ...splitLegacyPlayListings(product),
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
      // Newer Play Console accounts get "Please migrate to the new publishing
      // API" here; the new API already covered them, so it is not a failure.
      const reason = error instanceof Error ? error.message : String(error);
      if (!/migrate to the new publishing API/i.test(reason)) {
        failures.push({
          productId: "(play list inappproducts)",
          reason,
        });
      }
    }

    try {
      const offersByProduct = await listPlaySubscriptionOffers(
        androidpublisher,
        packageName,
        checkCancelled,
      );
      let token: string | undefined;
      let pageCount = 0;
      do {
        await checkCancelled();
        const subs = await androidpublisher.monetization.subscriptions.list({
          packageName,
          ...(token ? { pageToken: token } : {}),
        });
        for (const sub of subs.data.subscriptions ?? []) {
          if (!sub.productId) continue;
          await checkCancelled();
          try {
            const { priceAmountMicros, currency, basePlanId } =
              pickSubBasePlanPrice(
                sub,
                existingCurrencyByProductId.get(sub.productId ?? ""),
              );
            const offers = collectPlaySubscriptionOffers(
              sub,
              existingCurrencyByProductId.get(sub.productId ?? ""),
              offersByProduct.get(sub.productId),
            );
            // Price and billing period must come from the same base plan.
            const billingPeriod = (
              basePlanId
                ? offers.find(
                    (o) => o.kind === "BasePlan" && o.id === basePlanId,
                  )
                : offers.find((o) => o.kind === "BasePlan")
            )?.duration;
            await ctx.runMutation(internal.products.sync.upsertFromStore, {
              projectId: project._id,
              productId: sub.productId,
              platform: "Android",
              type: "Subscription",
              ...splitStoreListings(
                (sub.listings ?? []).map((entry) => ({
                  locale: entry.languageCode,
                  title: entry.title,
                  description: entry.description,
                })),
                sub.productId,
              ),
              priceAmountMicros,
              currency,
              storeRef: sub.productId,
              state: mapModernPlayOneTimeState(sub.basePlans),
              billingPeriod: coerceBillingPeriod(billingPeriod),
              // Play has no subscription groups; base plans fill that role as
              // BasePlan offers, so the ASC-only group fields stay unset.
              offers,
            });
            pulled += 1;
          } catch (error) {
            failures.push({
              productId: sub.productId,
              reason: `subscription import: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }
        token = subs.data.nextPageToken ?? undefined;
        pageCount += 1;
        if (pageCount > 50) break;
      } while (token);
    } catch (error) {
      if (error instanceof ProductSyncCancelledError) throw error;
      failures.push({
        productId: "(play list subscriptions)",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ── PUSH: kit → Play for Draft rows ──────────────────────────
  if (direction === "push" || direction === "both") {
    await checkCancelled();
    await reportPhase("push-removals", {
      current: pulled,
      failuresCount: failures.length,
    });
    const removals = await ctx.runQuery(
      internal.products.sync.listRemovedAndroidProducts,
      { projectId: project._id },
    );
    for (const row of removals) {
      await checkCancelled();
      const deleteStep =
        row.storeRef === undefined
          ? "delete local product row"
          : row.type === "Subscription"
            ? "delete subscription"
            : "delete one-time product";
      if (dryRun) {
        plannedWrites.push({
          productId: row.productId,
          step: deleteStep,
          detail: row.storeRef
            ? `storeRef=${row.storeRef}`
            : "kit-only row has no upstream storeRef",
        });
        continue;
      }
      try {
        if (row.storeRef) {
          if (row.type === "Subscription") {
            try {
              await androidpublisher.monetization.subscriptions.delete({
                packageName,
                productId: row.storeRef,
              });
            } catch (error) {
              if (!isGoogleNotFoundError(error)) throw error;
            }
          } else {
            await deleteAndroidOneTimeProduct(
              androidpublisher,
              auth,
              packageName,
              row.storeRef,
            );
          }
        }
        const didDelete = await ctx.runMutation(
          internal.products.sync.deleteRemovedProductRow,
          {
            projectId: project._id,
            productId: row.productId,
            platform: "Android",
          },
        );
        if (didDelete) deleted += 1;
      } catch (error) {
        failures.push({
          productId: `${row.productId} (delete)`,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await checkCancelled();
    await reportPhase("push-drafts", {
      current: pulled,
      failuresCount: failures.length,
    });
    const drafts = await ctx.runQuery(
      internal.products.sync.listDraftAndroidProducts,
      { projectId: project._id },
    );
    for (const row of drafts) {
      try {
        // Already in Play (storeRef set): patch, as asc.ts does, so later kit
        // edits reach Play; create would return 409. Re-pushing listings and
        // price is safe.
        if (row.storeRef) {
          // Only a patch Play accepted marks the row Ready; otherwise it stays
          // Draft and retries next sync.
          let patchOk = true;
          if (row.type === "Subscription") {
            // Listings only. A base-plan price change needs the separate
            // basePlans endpoint and a deactivate+recreate Play cannot do in
            // one call; the dashboard hints when kit's price differs so the
            // operator does it by hand.
            if (dryRun) {
              plannedWrites.push({
                productId: row.productId,
                step: "patch subscription listing",
                detail: `${row.title} (storeRef=${row.storeRef}) · ${describePlayListingPlan(row, { withRegions: false })}`,
              });
            } else {
              try {
                await androidpublisher.monetization.subscriptions.patch({
                  packageName,
                  productId: row.storeRef,
                  updateMask: "listings",
                  // Play requires a regions version on every write (400
                  // without it); googleapis takes it as a flat query param.
                  // No prices are sent here, so the historical pin is fine.
                  "regionsVersion.version": FALLBACK_REGIONS_VERSION,
                  requestBody: {
                    productId: row.storeRef,
                    listings: await mergedSubscriptionListings(
                      androidpublisher,
                      packageName,
                      row.storeRef,
                      row,
                    ),
                  },
                });
              } catch (error) {
                // Every error surfaces; a 404 means it was deleted in Play and
                // needs re-creating.
                patchOk = false;
                failures.push({
                  productId: `${row.productId} (subscription patch)`,
                  reason:
                    error instanceof Error ? error.message : String(error),
                });
              }
            }
          } else {
            // The helper tries the modern one-time-product API, then falls back
            // to legacy inappproducts.
            if (dryRun) {
              plannedWrites.push({
                productId: row.productId,
                step: "patch in-app product",
                detail:
                  `${row.title} (storeRef=${row.storeRef}) · ${describePlayListingPlan(row)}` +
                  (row.priceAmountMicros !== undefined && row.currency
                    ? ` · ${row.currency} ${(row.priceAmountMicros / 1_000_000).toFixed(2)}`
                    : ""),
              });
            } else {
              try {
                manualActions.push(
                  ...(await upsertAndroidOneTimeProduct(
                    androidpublisher,
                    auth,
                    {
                      packageName,
                      productId: row.storeRef,
                      title: row.title,
                      description: row.description ?? row.title,
                      baseLocale: row.baseLocale,
                      localizations: row.localizations,
                      regions: row.regions,
                      priceAmountMicros: row.priceAmountMicros,
                      currency: row.currency,
                    },
                    { allowCreate: false },
                  )),
                );
              } catch (error) {
                patchOk = false;
                failures.push({
                  productId: `${row.productId} (inapp patch)`,
                  reason:
                    error instanceof Error ? error.message : String(error),
                });
              }
            }
          }
          if (patchOk && !dryRun) {
            await ctx.runMutation(internal.products.sync.markPushed, {
              projectId: project._id,
              productId: row.productId,
              platform: "Android",
              storeRef: row.storeRef,
            });
            pushed += 1;
          } else if (patchOk && dryRun) {
            pushed += 1;
          }
          continue;
        }
        if (row.type === "Subscription") {
          // Without a base plan Play creates an unpurchasable draft, which
          // silently breaks the SDK's requestPurchase. Minting one needs a
          // price and currency; dry runs check too, so the operator sees this
          // before a real sync.
          if (!row.priceAmountMicros || !row.currency) {
            throw new Error(
              "Subscription requires priceAmountMicros + currency to mint a Play base plan; otherwise the product will not be purchasable.",
            );
          }
          // Each regional config must use its region's own currency, so Play
          // converts the base price and every returned region is written; a
          // lone US config is unbuyable elsewhere (#288). If conversion fails,
          // write the base region plus a manual action instead of failing.
          const basePlanId = basePlanIdForPeriod(row.billingPeriod);
          if (dryRun) {
            plannedWrites.push({
              productId: row.productId,
              step: "create subscription",
              detail: `${row.title} · base plan ${basePlanId} · ${row.billingPeriod ?? "P1M"} · ${row.currency} ${(row.priceAmountMicros / 1_000_000).toFixed(2)} · ${describePlayListingPlan(row, { withRegions: false })}`,
            });
            plannedWrites.push({
              productId: row.productId,
              step: "activate base plan",
              detail: basePlanId,
            });
          } else {
            // Real writes only: a dry run must not fail a non-USD subscription
            // on the USD-fallback guard for a price it will not send.
            const subscriptionBasePrice = microsToGoogleMoney(
              row.priceAmountMicros,
              row.currency,
            );
            const subscriptionConversion = await convertAndroidRegionPrices(
              androidpublisher,
              packageName,
              subscriptionBasePrice,
            );
            const subscriptionConverted = subscriptionConversion.response;
            const subscriptionRegionalConfigs =
              buildSubscriptionRegionalConfigs(
                subscriptionConverted,
                subscriptionBasePrice,
                row.productId,
              );
            const subscriptionOtherRegions =
              subscriptionConverted?.convertedOtherRegionsPrice;
            if (convertedRegionCount(subscriptionConverted) === 0) {
              manualActions.push({
                productId: row.productId,
                code: "regional_pricing_incomplete",
                message:
                  `Play could not convert ${row.currency} ${(row.priceAmountMicros / 1_000_000).toFixed(2)} into regional prices, so base plan "${basePlanId}" of "${row.productId}" ` +
                  `is available in ${subscriptionRegionalConfigs.length} region(s) only. Set the remaining regions in Play Console → the subscription's base plan → Set prices.` +
                  (subscriptionConversion.error
                    ? ` Play reported: ${subscriptionConversion.error}`
                    : ""),
              });
            }
            await androidpublisher.monetization.subscriptions.create({
              packageName,
              productId: row.productId,
              // Required (400 without it); see regionsVersionFor.
              "regionsVersion.version": regionsVersionFor(
                subscriptionConverted,
              ),
              requestBody: {
                productId: row.productId,
                listings: listingRowsForProduct(row).map((listing) => ({
                  languageCode: listing.locale,
                  title: listing.title,
                  description: listing.description ?? listing.title,
                })),
                // The base-plan id follows the period, so switching monthly to
                // yearly later does not collide with the existing id.
                basePlans: [
                  {
                    basePlanId,
                    autoRenewingBasePlanType: {
                      billingPeriodDuration: row.billingPeriod ?? "P1M",
                    },
                    regionalConfigs: subscriptionRegionalConfigs,
                    // Markets Play launches later. Requires both USD and
                    // EUR, so it only goes out when conversion gave both.
                    ...(subscriptionOtherRegions?.usdPrice &&
                    subscriptionOtherRegions.eurPrice
                      ? {
                          otherRegionsConfig: {
                            usdPrice: subscriptionOtherRegions.usdPrice,
                            eurPrice: subscriptionOtherRegions.eurPrice,
                            newSubscriberAvailability: true,
                          },
                        }
                      : {}),
                  },
                ],
              },
            });
            // Play creates base plans in DRAFT whatever the payload's `state`
            // says; they are not purchasable until activated.
            await androidpublisher.monetization.subscriptions.basePlans.activate(
              {
                packageName,
                productId: row.productId,
                basePlanId,
                requestBody: {
                  latencyTolerance:
                    "PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_TOLERANT",
                },
              },
            );
          }
        } else {
          if (dryRun) {
            plannedWrites.push({
              productId: row.productId,
              step: "create in-app product",
              detail:
                `${row.title} · ${row.type} · ${describePlayListingPlan(row)}` +
                (row.priceAmountMicros !== undefined && row.currency
                  ? ` · ${row.currency} ${(row.priceAmountMicros / 1_000_000).toFixed(2)}`
                  : " · no price set"),
            });
          } else {
            manualActions.push(
              ...(await upsertAndroidOneTimeProduct(
                androidpublisher,
                auth,
                {
                  packageName,
                  productId: row.productId,
                  title: row.title,
                  description: row.description ?? row.title,
                  baseLocale: row.baseLocale,
                  localizations: row.localizations,
                  regions: row.regions,
                  priceAmountMicros: row.priceAmountMicros,
                  currency: row.currency,
                },
                { allowCreate: true },
              )),
            );
          }
        }
        if (!dryRun) {
          // Save storeRef before markPushed: after a crash in between, the
          // next sync patches instead of re-creating (409). Play's productId
          // is the storeRef.
          await ctx.runMutation(internal.products.sync.markStoreRef, {
            projectId: project._id,
            productId: row.productId,
            platform: "Android",
            storeRef: row.productId,
          });
          await ctx.runMutation(internal.products.sync.markPushed, {
            projectId: project._id,
            productId: row.productId,
            platform: "Android",
            storeRef: row.productId,
          });
        }
        pushed += 1;
      } catch (error) {
        failures.push({
          productId: row.productId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    pulled,
    pushed,
    ...(deleted > 0 ? { deleted } : {}),
    failures,
    plannedWrites: dryRun ? plannedWrites : undefined,
    manualActions: manualActions.length > 0 ? manualActions : undefined,
  };
}

/**
 * Listings for a subscription patch, merged over what Play already has:
 * `updateMask: "listings"` replaces the array, so sending only kit's set would
 * delete locales added in Play Console. Read errors propagate (the row stays
 * Draft) because writing an unmerged set is destructive.
 */
export async function mergedSubscriptionListings(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  packageName: string,
  productId: string,
  row: {
    title: string;
    description?: string;
    baseLocale?: string;
    localizations?: ProductLocalization[];
  },
): Promise<androidpublisher_v3.Schema$SubscriptionListing[]> {
  const byLocale = new Map<
    string,
    androidpublisher_v3.Schema$SubscriptionListing
  >();

  const response = await androidpublisher.monetization.subscriptions.get({
    packageName,
    productId,
  });
  for (const listing of response.data.listings ?? []) {
    if (listing.languageCode) byLocale.set(listing.languageCode, listing);
  }

  for (const listing of listingRowsForProduct(row)) {
    byLocale.set(listing.locale, {
      // Preserve `benefits` and anything else already on this locale.
      ...byLocale.get(listing.locale),
      languageCode: listing.locale,
      title: listing.title,
      description: listing.description ?? listing.title,
    });
  }

  const baseLocale = row.baseLocale ?? BASE_LISTING_LOCALE;
  const base = byLocale.get(baseLocale);
  const rest = Array.from(byLocale.entries())
    .filter(([locale]) => locale !== baseLocale)
    .map(([, listing]) => listing);
  return base ? [base, ...rest] : rest;
}

/**
 * Human summary of what a push would publish. Pass `withRegions: false` for
 * listing-only writes so the preview does not claim a region footprint.
 */
function describePlayListingPlan(
  row: {
    baseLocale?: string;
    localizations?: ProductLocalization[];
    regions?: ProductRegions;
  },
  options: { withRegions: boolean } = { withRegions: true },
): string {
  const locales = [
    row.baseLocale ?? BASE_LISTING_LOCALE,
    ...(row.localizations ?? []).map((l) => l.locale),
  ].join(", ");
  if (!options.withRegions) return `locales ${locales}`;
  const regions =
    row.regions === "all"
      ? "all Play regions (converted)"
      : row.regions?.length
        ? row.regions.join(", ")
        : "the regions Play already sells it in (all, if it is new)";
  return `locales ${locales} · regions ${regions}`;
}

function googleErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };
  if (typeof candidate.code === "number") return candidate.code;
  if (typeof candidate.code === "string") {
    const parsed = Number.parseInt(candidate.code, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.response?.status === "number") {
    return candidate.response.status;
  }
  return undefined;
}

function isGoogleNotFoundError(error: unknown): boolean {
  return googleErrorStatus(error) === 404;
}

interface AndroidOneTimeProductUpsertArgs {
  packageName: string;
  productId: string;
  title: string;
  description: string;
  baseLocale?: string;
  localizations?: ProductLocalization[];
  regions?: ProductRegions;
  priceAmountMicros?: number;
  currency?: string;
}

/**
 * Play listings for a product: the base listing plus every kit locale, merged
 * over what is upstream, because `updateMask` replaces the whole array. Kit's
 * locales win and the rest are kept, so removing a locale in kit leaves it in
 * Play (as with regional configs).
 */
function listingsForAndroidProduct(
  args: {
    title: string;
    description: string;
    baseLocale?: string;
    localizations?: ProductLocalization[];
  },
  existingListings: Array<{
    languageCode?: string | null;
    title?: string | null;
    description?: string | null;
  }> = [],
): androidpublisher_v3.Schema$OneTimeProductListing[] {
  const byLocale = new Map<
    string,
    androidpublisher_v3.Schema$OneTimeProductListing
  >();

  for (const listing of existingListings) {
    if (listing.languageCode) byLocale.set(listing.languageCode, listing);
  }
  for (const row of listingRowsForProduct(args)) {
    byLocale.set(row.locale, {
      languageCode: row.locale,
      title: row.title,
      description: row.description ?? row.title,
    });
  }

  // Base locale first: legacy Play needs `defaultLanguage` to match a listing,
  // and a store may take the first entry as the default.
  const baseLocale = args.baseLocale ?? BASE_LISTING_LOCALE;
  const base = byLocale.get(baseLocale);
  const rest = Array.from(byLocale.entries())
    .filter(([locale]) => locale !== baseLocale)
    .map(([, listing]) => listing);
  return base ? [base, ...rest] : rest;
}

export async function upsertAndroidOneTimeProduct(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  auth: GoogleAuthClient,
  args: AndroidOneTimeProductUpsertArgs,
  options: { allowCreate: boolean },
): Promise<AndroidManualAction[]> {
  validateAndroidOneTimePrice(args);
  const manualActions: AndroidManualAction[] = [];

  try {
    const outcome = await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      args,
      options,
    );
    if (outcome.manualAction) manualActions.push(outcome.manualAction);
  } catch (error) {
    if (!shouldFallbackToLegacyOneTimeProduct(error, options)) throw error;
    // Checked only on fallback: the modern API honours a region footprint.
    assertLegacyPathUsableFor(args, error);

    if (options.allowCreate) {
      await insertLegacyAndroidOneTimeProduct(androidpublisher, args);
      return manualActions;
    }
    await patchLegacyAndroidOneTimeProduct(androidpublisher, args);
    return manualActions;
  }

  // Outside the try: an activation error is about the modern product, not a
  // reason to fall back to legacy.
  await activateAndroidOneTimePurchaseOption(auth, args);
  return manualActions;
}

function validateAndroidOneTimePrice(
  args: AndroidOneTimeProductUpsertArgs,
): void {
  if (!args.priceAmountMicros || !args.currency) {
    throw new Error(
      "One-time product requires priceAmountMicros + currency to mint a Play purchase option; otherwise the product will not be purchasable.",
    );
  }
}

/**
 * Regions version to write a resource at. Play converts prices with its current
 * region definitions but validates a write against the pinned version, so an
 * older pin rejects any region whose currency changed since (Bulgaria's move
 * from BGN to EUR fails a 2022/01 write with "Expected BGN but got EUR").
 */
const FALLBACK_REGIONS_VERSION = "2022/01";

function regionsVersionFor(
  converted: androidpublisher_v3.Schema$ConvertRegionPricesResponse | undefined,
  existingVersion?: string,
): string {
  // The conversion's version, else the one Play priced the existing configs at,
  // since echoing those configs under an older pin fails the same way. The
  // historical pin is only for a product Play has never priced.
  return (
    converted?.regionVersion?.version ??
    existingVersion ??
    FALLBACK_REGIONS_VERSION
  );
}

/**
 * Number of regions Play returned a usable price for. Use it for every "did
 * conversion work" check: `convertedRegionPrices` is an object, and a truthy
 * `{}` would ship the product US-only while reporting a clean sync.
 */
function convertedRegionCount(
  converted: androidpublisher_v3.Schema$ConvertRegionPricesResponse | undefined,
): number {
  return Object.values(converted?.convertedRegionPrices ?? {}).filter(
    (region) => region.price,
  ).length;
}

/**
 * Asks Play to convert one base price into every region it sells in.
 *
 * The modern one-time-product API has no `autoConvertMissingPrices`, so a
 * product is only buyable outside its base region if every converted region is
 * written (#288). A failure returns its reason instead of throwing: the push
 * then writes one region plus a manual action, and "conversion unavailable"
 * needs a different fix than "missing pricing permission".
 */
async function convertAndroidRegionPrices(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  packageName: string,
  price: androidpublisher_v3.Schema$Money,
): Promise<{
  response?: androidpublisher_v3.Schema$ConvertRegionPricesResponse;
  error?: string;
}> {
  try {
    const response = await androidpublisher.monetization.convertRegionPrices({
      packageName,
      requestBody: { price },
    });
    return { response: response.data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Marks a region unavailable while keeping its config.
 *
 * `NO_LONGER_AVAILABLE` is only legal for a region that is currently
 * `AVAILABLE`, so anything already withdrawn (or never released) is left
 * exactly as Play has it.
 */
function withdrawRegion(
  existing: androidpublisher_v3.Schema$OneTimeProductPurchaseOptionRegionalPricingAndAvailabilityConfig,
): androidpublisher_v3.Schema$OneTimeProductPurchaseOptionRegionalPricingAndAvailabilityConfig {
  if (existing.availability === "NO_LONGER_AVAILABLE") {
    return existing;
  }
  if (existing.availability && existing.availability !== "AVAILABLE") {
    throw new Error(
      `Play cannot withdraw region ${existing.regionCode ?? "(unknown)"} while its availability is ${existing.availability}. Google only permits NO_LONGER_AVAILABLE after AVAILABLE; change the pre-release or offer-only state in Play Console, then retry the sync.`,
    );
  }
  return { ...existing, availability: "NO_LONGER_AVAILABLE" };
}

/**
 * Builds the regional pricing rows for a purchase option.
 *
 * `existingByRegion` holds the product's current configs on an update. Inherit
 * mode reprices only those regions and keeps their availability, so a
 * price-only push cannot reopen a market withdrawn in Play Console; an explicit
 * list or `"all"` is an operator footprint change and may.
 *
 * Without a conversion there is no legal foreign price (each region needs its
 * own currency): regions already in the base currency take the new amount and
 * the rest keep their old price. `repricedRegions` says which took it, so the
 * caller can say the rest did not.
 */
function buildRegionalPricingConfigs(
  converted: androidpublisher_v3.Schema$ConvertRegionPricesResponse | undefined,
  basePrice: androidpublisher_v3.Schema$Money,
  productId: string,
  existingByRegion: Map<
    string,
    androidpublisher_v3.Schema$OneTimeProductPurchaseOptionRegionalPricingAndAvailabilityConfig
  >,
  allowedRegions?: Set<string>,
  reactivateIncludedRegions = false,
): {
  configs: androidpublisher_v3.Schema$OneTimeProductPurchaseOptionRegionalPricingAndAvailabilityConfig[];
  /** Region codes that actually took the new amount. */
  repricedRegions: Set<string>;
} {
  const configs = new Map<
    string,
    androidpublisher_v3.Schema$OneTimeProductPurchaseOptionRegionalPricingAndAvailabilityConfig
  >();
  const repricedRegions = new Set<string>();

  for (const [regionCode, regionPrice] of Object.entries(
    converted?.convertedRegionPrices ?? {},
  )) {
    if (!regionPrice.price) continue;
    const existing = existingByRegion.get(regionCode);
    // Play refuses to drop a region once added ("Cannot remove region once it
    // has been added"): an excluded region is withdrawn, and one the product
    // never had is skipped.
    if (allowedRegions && !allowedRegions.has(regionCode)) {
      if (!existing) continue;
      configs.set(regionCode, {
        ...withdrawRegion(existing),
        // Converted price even when withdrawing: the old one may be in a
        // retired currency (BGN) that the pinned regions version rejects.
        price: regionPrice.price,
      });
      continue;
    }
    configs.set(regionCode, {
      regionCode,
      // Each region needs its own currency: never the base amount.
      price: regionPrice.price,
      availability: reactivateIncludedRegions
        ? "AVAILABLE"
        : (existing?.availability ?? "AVAILABLE"),
    });
    repricedRegions.add(regionCode);
  }

  for (const [regionCode, existing] of existingByRegion) {
    if (configs.has(regionCode)) continue;
    if (allowedRegions && !allowedRegions.has(regionCode)) {
      configs.set(regionCode, withdrawRegion(existing));
      continue;
    }
    // Degraded path: keep a price edit in regions already priced in the base
    // currency.
    if (
      convertedRegionCount(converted) === 0 &&
      existing.price?.currencyCode === basePrice.currencyCode
    ) {
      configs.set(regionCode, {
        ...existing,
        price: basePrice,
        ...(reactivateIncludedRegions ? { availability: "AVAILABLE" } : {}),
      });
      repricedRegions.add(regionCode);
      continue;
    }
    configs.set(regionCode, existing);
  }

  const hasAvailableIncludedRegion = Array.from(configs.values()).some(
    (config) =>
      (!allowedRegions || allowedRegions.has(config.regionCode ?? "")) &&
      (config.availability ?? "AVAILABLE") !== "NO_LONGER_AVAILABLE",
  );

  if (
    configs.size === 0 ||
    (reactivateIncludedRegions && !hasAvailableIncludedRegion)
  ) {
    // Nothing to keep and no conversion: fall back to US so the product sells
    // somewhere (the caller reports a manual action). If the operator's regions
    // exclude US there is nothing legal to write, so fail.
    if (allowedRegions && !allowedRegions.has("US")) {
      throw new Error(
        `Play could not convert ${basePrice.currencyCode} into regional prices for "${productId}", and its sales regions (${[...allowedRegions].join(", ")}) exclude the US fallback. Retry the sync, or set the prices in Play Console.`,
      );
    }
    configs.set(assertUsdFallbackRegion(basePrice, productId), {
      regionCode: "US",
      availability: "AVAILABLE",
      price: basePrice,
    });
    repricedRegions.add("US");
  }

  return { configs: Array.from(configs.values()), repricedRegions };
}

/**
 * Guards the US-only fallback used when Play cannot convert prices: only a USD
 * price is legal there, and Play's own 400 would not say what to do.
 */
function assertUsdFallbackRegion(
  basePrice: androidpublisher_v3.Schema$Money,
  productId: string,
): string {
  if (basePrice.currencyCode !== "USD") {
    throw new Error(
      `Play could not convert ${basePrice.currencyCode} into regional prices for "${productId}", and a non-USD amount cannot be published to the US fallback region. Retry the sync, or set this product's regional prices in Play Console and let the next pull-sync mirror them back.`,
    );
  }
  return "US";
}

/**
 * Regional base-plan configs for a subscription create:
 * {@link buildRegionalPricingConfigs} without the merge, since a new
 * subscription has nothing upstream to keep.
 */
export function buildSubscriptionRegionalConfigs(
  converted: androidpublisher_v3.Schema$ConvertRegionPricesResponse | undefined,
  basePrice: androidpublisher_v3.Schema$Money,
  productId: string,
  allowedRegions?: Set<string>,
): androidpublisher_v3.Schema$RegionalBasePlanConfig[] {
  const configs: androidpublisher_v3.Schema$RegionalBasePlanConfig[] = [];

  for (const [regionCode, regionPrice] of Object.entries(
    converted?.convertedRegionPrices ?? {},
  )) {
    if (!regionPrice.price) continue;
    if (allowedRegions && !allowedRegions.has(regionCode)) continue;
    configs.push({
      regionCode,
      price: regionPrice.price,
      newSubscriberAvailability: true,
    });
  }

  if (configs.length === 0) {
    configs.push({
      regionCode: assertUsdFallbackRegion(basePrice, productId),
      price: basePrice,
      newSubscriberAvailability: true,
    });
  }

  return configs;
}

function buildAndroidOneTimeProduct(
  args: AndroidOneTimeProductUpsertArgs,
  regionalPricingAndAvailabilityConfigs: androidpublisher_v3.Schema$OneTimeProductPurchaseOptionRegionalPricingAndAvailabilityConfig[],
  newRegionsConfig:
    | androidpublisher_v3.Schema$OneTimeProductPurchaseOptionNewRegionsConfig
    | undefined,
  existing: Pick<
    ExistingOneTimeProductState,
    "buyOption" | "otherPurchaseOptions" | "listings"
  >,
): androidpublisher_v3.Schema$OneTimeProduct {
  return {
    packageName: args.packageName,
    productId: args.productId,
    listings: listingsForAndroidProduct(args, existing.listings),
    purchaseOptions: [
      {
        // Upstream first, so fields kit does not model (offerTags,
        // taxAndComplianceSettings, newRegionsConfig) survive; the keys below
        // are kit's.
        ...stripReadOnlyPurchaseOptionFields(existing.buyOption),
        purchaseOptionId: "buy",
        buyOption: {
          legacyCompatible: true,
          multiQuantityEnabled: false,
        },
        regionalPricingAndAvailabilityConfigs,
        ...(newRegionsConfig ? { newRegionsConfig } : {}),
      },
      // `updateMask` replaces the whole list: echo back options added in Play
      // Console (rent, a second buy, pre-order) or the push deletes them.
      ...existing.otherPurchaseOptions.map((option) =>
        stripReadOnlyPurchaseOptionFields(option),
      ),
    ],
  };
}

/**
 * Drops output-only fields Play rejects on write: echoing `state` ("This field
 * cannot be changed by updating the resource") returns a 400.
 */
function stripReadOnlyPurchaseOptionFields(
  option: androidpublisher_v3.Schema$OneTimeProductPurchaseOption | undefined,
): androidpublisher_v3.Schema$OneTimeProductPurchaseOption {
  if (!option) return {};
  const { state: _state, ...writable } = option;
  return writable;
}

interface ExistingOneTimeProductState {
  /** Regional configs on the `buy` option, keyed by region code. */
  regionsByCode: Map<
    string,
    androidpublisher_v3.Schema$OneTimeProductPurchaseOptionRegionalPricingAndAvailabilityConfig
  >;
  /** The existing `buy` option, so its non-pricing fields survive. */
  buyOption?: androidpublisher_v3.Schema$OneTimeProductPurchaseOption;
  /** Every purchase option kit doesn't own, echoed back on write. */
  otherPurchaseOptions: androidpublisher_v3.Schema$OneTimeProductPurchaseOption[];
  /** Upstream listings, so locales kit doesn't model survive. */
  listings: androidpublisher_v3.Schema$OneTimeProductListing[];
  /** Output-only version Play generated the preserved configs at. */
  regionsVersion?: string;
}

/**
 * Reads the product's current purchase options, which a write must echo because
 * `updateMask: "purchaseOptions"` replaces them. Returns empty state for a
 * product that does not exist yet.
 */
async function readExistingOneTimeProduct(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  args: AndroidOneTimeProductUpsertArgs,
): Promise<ExistingOneTimeProductState> {
  const empty: ExistingOneTimeProductState = {
    regionsByCode: new Map(),
    otherPurchaseOptions: [],
    listings: [],
  };

  let product: androidpublisher_v3.Schema$OneTimeProduct | undefined;
  try {
    const response = await androidpublisher.monetization.onetimeproducts.get({
      packageName: args.packageName,
      productId: args.productId,
    });
    product = response.data;
  } catch (error) {
    if (isGoogleNotFoundError(error)) return empty;
    throw error;
  }

  const options = product.purchaseOptions ?? [];
  const buyOption = options.find((option) => option.purchaseOptionId === "buy");
  for (const config of buyOption?.regionalPricingAndAvailabilityConfigs ?? []) {
    if (config.regionCode) empty.regionsByCode.set(config.regionCode, config);
  }
  return {
    regionsByCode: empty.regionsByCode,
    buyOption,
    otherPurchaseOptions: options.filter(
      (option) => option.purchaseOptionId !== "buy",
    ),
    listings: product.listings ?? [],
    regionsVersion: product.regionsVersion?.version ?? undefined,
  };
}

export async function upsertModernAndroidOneTimeProduct(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  args: AndroidOneTimeProductUpsertArgs,
  options: { allowCreate: boolean },
): Promise<{ manualAction?: AndroidManualAction }> {
  if (args.priceAmountMicros === undefined || !args.currency) {
    throw new Error(
      "One-time product requires priceAmountMicros + currency to mint a Play purchase option; otherwise the product will not be purchasable.",
    );
  }
  const basePrice = microsToGoogleMoney(args.priceAmountMicros, args.currency);

  // Also on create: `allowMissing` upserts, so a retried create can land on an
  // existing product and must not flatten it.
  const existing = await readExistingOneTimeProduct(androidpublisher, args);

  const conversion = await convertAndroidRegionPrices(
    androidpublisher,
    args.packageName,
    basePrice,
  );
  const converted = conversion.response;
  const convertedVersion = converted?.regionVersion?.version;
  if (
    convertedVersion &&
    existing.regionsVersion &&
    convertedVersion !== existing.regionsVersion
  ) {
    const convertedCodes = new Set(
      Object.entries(converted.convertedRegionPrices ?? {})
        .filter(([, value]) => value.price)
        .map(([regionCode]) => regionCode),
    );
    const staleBuyRegions = [...existing.regionsByCode.keys()].filter(
      (regionCode) => !convertedCodes.has(regionCode),
    );
    const preservedOtherOptions = existing.otherPurchaseOptions.some(
      (option) =>
        (option.regionalPricingAndAvailabilityConfigs?.length ?? 0) > 0,
    );
    if (staleBuyRegions.length > 0 || preservedOtherOptions) {
      throw new Error(
        `Play moved "${args.productId}" from regions version ${existing.regionsVersion} to ${convertedVersion}, but kit cannot safely translate ` +
          (staleBuyRegions.length > 0
            ? `the preserved ${staleBuyRegions.join(", ")} price config${staleBuyRegions.length === 1 ? "" : "s"}`
            : "prices on purchase options other than buy") +
          ". Update those prices in Play Console, then run sync again so kit can read the current-version configs.",
      );
    }
  }
  // `regions`:
  //   ["US","KR"]  explicit footprint; every other region is withdrawn.
  //   "all"        sell wherever Play prices; expands on purpose.
  //   unset        inherit: a new product goes out everywhere (Play Console's
  //                default, #288); an existing one keeps its regions and is
  //                only repriced, so a price change never expands it.
  const explicitFootprint = Array.isArray(args.regions)
    ? new Set(args.regions)
    : undefined;
  const explicitlyManagedFootprint =
    explicitFootprint !== undefined || args.regions === "all";
  const inheritedFootprint =
    args.regions === undefined && existing.regionsByCode.size > 0
      ? new Set(existing.regionsByCode.keys())
      : undefined;
  const allowedRegions = explicitFootprint ?? inheritedFootprint;
  const { configs: regionalConfigs, repricedRegions } =
    buildRegionalPricingConfigs(
      converted,
      basePrice,
      args.productId,
      existing.regionsByCode,
      allowedRegions,
      explicitlyManagedFootprint,
    );

  // "Other regions" covers markets Play launches later and needs both a USD and
  // an EUR price. Without a footprint, keep its availability and refresh only
  // the amounts; with an explicit footprint, actively withdraw it, since the
  // spread existing option would otherwise carry an enabled config forward.
  const existingNewRegions = existing.buyOption?.newRegionsConfig;
  const otherRegions = explicitFootprint
    ? undefined
    : // Inheriting: refresh an existing config but never create one, which
      // would opt the product into every market Play launches from now on.
      inheritedFootprint && !existingNewRegions
      ? undefined
      : converted?.convertedOtherRegionsPrice;
  const newRegionsConfig =
    otherRegions?.usdPrice && otherRegions.eurPrice
      ? {
          // "all" follows Play into future markets, so it reopens a withdrawn
          // config; inherit keeps the Play Console choice.
          availability:
            args.regions === "all"
              ? "AVAILABLE"
              : (existingNewRegions?.availability ?? "AVAILABLE"),
          usdPrice: otherRegions.usdPrice,
          eurPrice: otherRegions.eurPrice,
        }
      : explicitFootprint &&
          existingNewRegions &&
          (existingNewRegions.availability ?? "AVAILABLE") === "AVAILABLE"
        ? { ...existingNewRegions, availability: "NO_LONGER_AVAILABLE" }
        : // Explicit, not undefined, which would rely on the spread; only an
          // explicit footprint withdraws, inheriting keeps the Play setting.
          existingNewRegions;

  // Use the generated method: in googleapis v157 this route is lowercase
  // `/onetimeproducts/{productId}`, unlike its camel-case siblings.
  await androidpublisher.monetization.onetimeproducts.patch({
    packageName: args.packageName,
    productId: args.productId,
    allowMissing: options.allowCreate,
    updateMask: "listings,purchaseOptions",
    "regionsVersion.version": regionsVersionFor(
      converted,
      existing.regionsVersion,
    ),
    requestBody: buildAndroidOneTimeProduct(
      args,
      regionalConfigs,
      newRegionsConfig,
      existing,
    ),
  });

  // Absent availability means AVAILABLE. Test "not withdrawn", not "equals
  // AVAILABLE": the product still sells in an AVAILABLE_IF_RELEASED region.
  const isLive = (
    config: androidpublisher_v3.Schema$OneTimeProductPurchaseOptionRegionalPricingAndAvailabilityConfig,
  ) =>
    (config.availability ?? "AVAILABLE") !== "NO_LONGER_AVAILABLE" &&
    !(allowedRegions && !allowedRegions.has(config.regionCode ?? ""));

  // A requested region Play did not price is silently missing from the write,
  // so report it (for example a valid code that is not a Play sales region).
  const unpriced = explicitFootprint
    ? [...explicitFootprint].filter(
        (region) =>
          !regionalConfigs.some(
            (config) => config.regionCode === region && isLive(config),
          ),
      )
    : [];
  const unpricedNote =
    unpriced.length > 0
      ? ` Play does not sell "${args.productId}" in ${unpriced.join(", ")}, so ${unpriced.length === 1 ? "that region was" : "those regions were"} skipped — remove ${unpriced.length === 1 ? "it" : "them"} from the product's sales regions, or check the code.`
      : "";

  // Both counts from the same final configs, or `stale` can go negative and
  // drop the warning.
  const live = regionalConfigs.filter(isLive);
  const applied = live.filter((config) =>
    repricedRegions.has(config.regionCode ?? ""),
  ).length;
  const stale = live.length - applied;

  // An inherited narrow footprint is safe but may be an accident (US-only), so
  // report how many markets it leaves out. Counted only when conversion worked;
  // a failed one knows nothing about availability.
  const convertedRegions = Object.entries(
    converted?.convertedRegionPrices ?? {},
  )
    .filter(([, value]) => value.price)
    .map(([region]) => region);
  const inheritedLiveRegionCount = inheritedFootprint
    ? convertedRegions.filter((region) => {
        const config = existing.regionsByCode.get(region);
        return (
          config !== undefined &&
          (config.availability ?? "AVAILABLE") !== "NO_LONGER_AVAILABLE"
        );
      }).length
    : 0;
  const expandable = inheritedFootprint
    ? convertedRegions.length - inheritedLiveRegionCount
    : 0;
  const expansionNote =
    expandable > 0
      ? ` "${args.productId}" remains available in ${inheritedLiveRegionCount} of the ${convertedRegions.length} regions Play returned prices for. Its current footprint was preserved — set the product's sales regions to "all" to publish the other ${expandable}.`
      : "";

  if (convertedRegionCount(converted) > 0) {
    // Conversion worked: report unpriced regions and skipped expansion.
    const note = `${unpricedNote}${expansionNote}`.trim();
    return note
      ? {
          manualAction: {
            productId: args.productId,
            code: expansionNote
              ? "regional_expansion_available"
              : "regional_pricing_incomplete",
            message: note,
          },
        }
      : {};
  }

  // Conversion failed: the write went out, but only `applied` live regions took
  // the new amount. Say so; a clean result would read as the new price being
  // live everywhere.
  const amount = `${args.currency} ${(args.priceAmountMicros / 1_000_000).toFixed(2)}`;
  return {
    manualAction: {
      productId: args.productId,
      code: "regional_pricing_incomplete",
      message:
        `Play could not convert ${amount} into regional prices for "${args.productId}", so it applied to ${applied} region(s)` +
        (stale > 0 ? ` and ${stale} region(s) kept their previous price` : "") +
        `. Set the remaining prices in Play Console → the product's purchase option → Set prices, or re-run the sync.` +
        (conversion.error ? ` Play reported: ${conversion.error}` : "") +
        unpricedNote,
    },
  };
}

/**
 * Legacy listings are a locale-keyed map; `defaultLanguage` must name one of
 * its keys, which the base locale always is.
 */
function legacyListingsMap(
  args: AndroidOneTimeProductUpsertArgs,
  existing: {
    [locale: string]: androidpublisher_v3.Schema$InAppProductListing;
  } = {},
): {
  [locale: string]: androidpublisher_v3.Schema$InAppProductListing;
} {
  const listings: {
    [locale: string]: androidpublisher_v3.Schema$InAppProductListing;
  } = { ...existing };
  for (const row of listingRowsForProduct(args)) {
    listings[row.locale] = {
      title: row.title,
      description: row.description ?? row.title,
    };
  }
  return listings;
}

/** Message for an unknown upstream throwable, without "[object Object]". */
function describeUpstreamError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "an unknown error";
}

/**
 * The legacy `inappproducts` API has no regions: it prices a SKU from
 * `defaultPrice` and, with `autoConvertMissingPrices`, everywhere else. An
 * explicit region list cannot be honoured there, and publishing everywhere
 * would be the opposite of what the operator asked. The message carries the
 * modern API's failure that caused the fallback.
 */
export function assertLegacyPathUsableFor(
  args: AndroidOneTimeProductUpsertArgs,
  modernError?: unknown,
): void {
  // Legacy prices every region, which is exactly what "all" asks for.
  if (args.regions === "all" || !args.regions?.length) return;
  throw new Error(
    `"${args.productId}" specifies sales regions, but this app fell back to Play's legacy in-app-products API, which prices every region or none. Remove the region list, or migrate the app to Play's one-time products model.` +
      (modernError
        ? ` The one-time-products API reported: ${describeUpstreamError(modernError)}`
        : ""),
  );
}

async function insertLegacyAndroidOneTimeProduct(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  args: AndroidOneTimeProductUpsertArgs,
): Promise<void> {
  await androidpublisher.inappproducts.insert({
    packageName: args.packageName,
    // Otherwise legacy prices only the merchant currency and every other region
    // is unbuyable (#288).
    autoConvertMissingPrices: true,
    requestBody: {
      packageName: args.packageName,
      sku: args.productId,
      purchaseType: "managedUser",
      status: "active",
      defaultLanguage: args.baseLocale ?? BASE_LISTING_LOCALE,
      listings: legacyListingsMap(args),
      defaultPrice: {
        priceMicros: String(args.priceAmountMicros),
        currency: args.currency,
      },
    },
  });
}

async function patchLegacyAndroidOneTimeProduct(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  args: AndroidOneTimeProductUpsertArgs,
): Promise<void> {
  // PATCH replaces the locale-keyed map. Read first so a locale authored in
  // Play Console is not deleted when kit updates only its own listings.
  const existing = await androidpublisher.inappproducts.get({
    packageName: args.packageName,
    sku: args.productId,
  });
  await androidpublisher.inappproducts.patch({
    packageName: args.packageName,
    sku: args.productId,
    autoConvertMissingPrices: true,
    requestBody: {
      packageName: args.packageName,
      sku: args.productId,
      purchaseType: "managedUser",
      defaultLanguage:
        args.baseLocale ?? existing.data.defaultLanguage ?? BASE_LISTING_LOCALE,
      listings: legacyListingsMap(args, existing.data.listings ?? {}),
      defaultPrice: {
        priceMicros: String(args.priceAmountMicros),
        currency: args.currency,
      },
    },
  });
}

export function shouldFallbackToLegacyOneTimeProduct(
  error: unknown,
  options: { allowCreate: boolean },
): boolean {
  const status = googleErrorStatus(error);
  const message = error instanceof Error ? error.message : String(error);
  const explicitlyRequiresLegacyApi =
    message.includes("inappproducts") ||
    message.includes("InAppProduct") ||
    message.includes("Please use the InAppProducts API");
  if (explicitlyRequiresLegacyApi) return true;

  // On update, a modern 404 may be a SKU that exists only in the legacy
  // catalog, so fall back. A create uses allowMissing, so its 404 cannot mean
  // "absent" and must stay visible.
  return !options.allowCreate && status === 404;
}

async function activateAndroidOneTimePurchaseOption(
  auth: GoogleAuthClient,
  args: AndroidOneTimeProductUpsertArgs,
): Promise<void> {
  const client = await auth.getClient();
  await client.request({
    method: "POST",
    url:
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(args.packageName)}/oneTimeProducts/` +
      `${encodeURIComponent(args.productId)}/purchaseOptions:batchUpdateStates`,
    data: {
      requests: [
        {
          activatePurchaseOptionRequest: {
            packageName: args.packageName,
            productId: args.productId,
            purchaseOptionId: "buy",
            latencyTolerance:
              "PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_TOLERANT",
          },
        },
      ],
    },
  });
}

async function deleteAndroidOneTimeProduct(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  auth: GoogleAuthClient,
  packageName: string,
  productId: string,
): Promise<void> {
  try {
    await deleteModernAndroidOneTimeProduct(auth, packageName, productId);
    return;
  } catch (error) {
    if (!isGoogleNotFoundError(error)) throw error;
  }

  const monetizationApi = androidpublisher.monetization as
    | { onetimeproducts?: unknown }
    | undefined;
  const onetime = (
    monetizationApi as unknown as {
      onetimeproducts?: {
        delete?: (params: {
          packageName: string;
          productId: string;
        }) => Promise<unknown>;
      };
    }
  ).onetimeproducts;

  if (onetime?.delete) {
    try {
      await onetime.delete({ packageName, productId });
      return;
    } catch (error) {
      if (!isGoogleNotFoundError(error)) throw error;
    }
  }

  try {
    await androidpublisher.inappproducts.delete({
      packageName,
      sku: productId,
    });
  } catch (error) {
    if (!isGoogleNotFoundError(error)) throw error;
  }
}

async function deleteModernAndroidOneTimeProduct(
  auth: GoogleAuthClient,
  packageName: string,
  productId: string,
): Promise<void> {
  const client = await auth.getClient();
  await client.request({
    method: "DELETE",
    url:
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${encodeURIComponent(packageName)}/oneTimeProducts/` +
      `${encodeURIComponent(productId)}`,
  });
}

function mapPlayOneTimeType(
  product: androidpublisher_v3.Schema$InAppProduct,
): "NonConsumable" | "Consumable" {
  if (product.purchaseType === "managedUser") return "NonConsumable";
  return "Consumable";
}

function preservePlayOneTimeType(
  existingType: "Subscription" | "NonConsumable" | "Consumable" | undefined,
  fallback: "NonConsumable" | "Consumable",
): "NonConsumable" | "Consumable" {
  if (existingType === "Consumable" || existingType === "NonConsumable") {
    return existingType;
  }
  return fallback;
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

export function mapModernPlayOneTimeState(
  purchaseOptions: Array<{ state?: string | null }> | null | undefined,
): "Draft" | "Active" | "Removed" {
  const states = (purchaseOptions ?? []).map((option) =>
    option.state?.toUpperCase(),
  );
  if (states.includes("ACTIVE")) return "Active";
  if (states.includes("INACTIVE") || states.includes("INACTIVE_PUBLISHED")) {
    return "Removed";
  }
  if (states.length > 0 && states.every((state) => state === "DRAFT")) {
    return "Draft";
  }
  // Missing or future states must not become a kit Draft: a `both` sync would
  // treat that as an instruction to push and could make the option sellable.
  return "Removed";
}

export function playPriceMicrosToNumber(
  raw: string | undefined | null,
): number | undefined {
  if (!raw) return undefined;
  if (!/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
}

/** Preserve every legacy Play listing and its declared default locale. */
export function splitLegacyPlayListings(
  product: androidpublisher_v3.Schema$InAppProduct,
): ReturnType<typeof splitStoreListings> {
  return splitStoreListings(
    Object.entries(product.listings ?? {}).map(([locale, listing]) => ({
      locale,
      title: listing.title,
      description: listing.description,
    })),
    product.sku ?? "product",
    product.defaultLanguage ?? BASE_LISTING_LOCALE,
  );
}

function parsePlayPriceMicros(
  product: androidpublisher_v3.Schema$InAppProduct,
): number | undefined {
  return playPriceMicrosToNumber(product.defaultPrice?.priceMicros);
}

function pickPlayCurrency(
  product: androidpublisher_v3.Schema$InAppProduct,
): string | undefined {
  return product.defaultPrice?.currency ?? undefined;
}

/**
 * Chooses which region's price represents a pulled one-time product.
 *
 * Preference order:
 *   1. the authored currency, in the US region, then anywhere: pushing converts
 *      the base price into every region, so a US-first rule would read a
 *      KRW/JPY row back as dollars and the next push would convert that again;
 *   2. US, then any USD region: Play prices some non-US regions in USD (EC, SV,
 *      TL, ZW...), so currency alone could pick one of those;
 *   3. whatever is left, for a first import kit has never priced.
 */
export function pickPlayRegionalPrice<
  T extends { regionCode?: string | null; currencyCode?: string | null },
>(candidates: T[], authoredCurrency?: string): T | undefined {
  return (
    (authoredCurrency
      ? (candidates.find(
          (c) => c.regionCode === "US" && c.currencyCode === authoredCurrency,
        ) ?? candidates.find((c) => c.currencyCode === authoredCurrency))
      : undefined) ??
    candidates.find((c) => c.regionCode === "US") ??
    candidates.find((c) => c.currencyCode === "USD") ??
    candidates[0]
  );
}

/** Selects the best regional base-plan price while preserving its plan ID. */
export function pickSubBasePlanPrice(
  sub: androidpublisher_v3.Schema$Subscription,
  preferredCurrency?: string,
): {
  priceAmountMicros?: number;
  currency?: string;
  // Plan the price came from, so `billingPeriod` comes from the same plan;
  // mixing monthly and yearly plans broke MRR normalization.
  basePlanId?: string;
} {
  type Candidate = {
    price: androidpublisher_v3.Schema$Money;
    basePlanId?: string;
    regionCode?: string | null;
    currencyCode?: string | null;
  };
  const candidates: Candidate[] = [];
  for (const plan of sub.basePlans ?? []) {
    if (plan.state !== "ACTIVE") continue;
    const basePlanId = plan.basePlanId ?? undefined;
    for (const region of plan.regionalConfigs ?? []) {
      if (region.newSubscriberAvailability === true && region.price) {
        candidates.push({
          price: region.price,
          basePlanId,
          regionCode: region.regionCode,
          currencyCode: region.price.currencyCode,
        });
      }
    }
  }
  if (candidates.length === 0) return {};
  // Authored currency first, then USD, the most recognizable dashboard value.
  const preferred = pickPlayRegionalPrice(candidates, preferredCurrency);
  if (!preferred) return {};
  return {
    priceAmountMicros: moneyToMicros(preferred.price),
    currency: preferred.price.currencyCode ?? undefined,
    basePlanId: preferred.basePlanId,
  };
}

type ProductOffer = NonNullable<Doc<"products">["offers"]>[number];

/** Flattens active Play base plans and their separately listed offers. */
export function collectPlaySubscriptionOffers(
  sub: androidpublisher_v3.Schema$Subscription,
  preferredCurrency?: string,
  subscriptionOffers: androidpublisher_v3.Schema$SubscriptionOffer[] = [],
): ProductOffer[] {
  function phasePrice(
    plan: androidpublisher_v3.Schema$BasePlan,
    phase: androidpublisher_v3.Schema$SubscriptionOfferPhase,
    region: androidpublisher_v3.Schema$RegionalSubscriptionOfferPhaseConfig,
  ): { isFree: boolean; priceAmountMicros?: number; currency?: string } {
    if (region.free != null) return { isFree: true };
    if (region.price) {
      const priceAmountMicros = moneyToMicros(region.price);
      if (priceAmountMicros === undefined || !region.price.currencyCode) {
        throw new Error("Invalid Play offer phase price");
      }
      return {
        isFree: priceAmountMicros === 0,
        priceAmountMicros:
          priceAmountMicros === 0 ? undefined : priceAmountMicros,
        currency:
          priceAmountMicros === 0 ? undefined : region.price.currencyCode,
      };
    }
    if (region.relativeDiscount == null && !region.absoluteDiscount) {
      throw new Error("Play offer phase has no price override");
    }
    const basePrice = plan.regionalConfigs?.find(
      (base) => base.regionCode === region.regionCode,
    )?.price;
    const baseMicros = moneyToMicros(basePrice);
    const currency = basePrice?.currencyCode;
    if (baseMicros === undefined || !currency) {
      throw new Error(`Missing base-plan price for ${region.regionCode}`);
    }
    const discount = region.relativeDiscount;
    const absoluteMicros = moneyToMicros(region.absoluteDiscount);
    if (discount != null) {
      if (!Number.isFinite(discount) || discount <= 0 || discount >= 1) {
        throw new Error("Invalid Play relative discount");
      }
    } else if (
      absoluteMicros === undefined ||
      region.absoluteDiscount?.currencyCode !== currency
    ) {
      throw new Error("Invalid Play absolute discount currency or amount");
    }

    function periodUnits(
      period: string | null | undefined,
    ): { family: "months" | "days"; count: number } | undefined {
      const match = /^P([1-9]\d*)([DWMY])$/.exec(period ?? "");
      if (!match) return undefined;
      const count = Number(match[1]);
      const unit = match[2];
      return unit === "M" || unit === "Y"
        ? { family: "months", count: count * (unit === "Y" ? 12 : 1) }
        : { family: "days", count: count * (unit === "W" ? 7 : 1) };
    }
    const basePeriod = periodUnits(
      plan.autoRenewingBasePlanType?.billingPeriodDuration ??
        plan.installmentsBasePlanType?.billingPeriodDuration ??
        plan.prepaidBasePlanType?.billingPeriodDuration,
    );
    const offerPeriod = periodUnits(phase.duration);
    // Calendar months cannot be converted to an exact day count from catalog data.
    if (
      !basePeriod ||
      !offerPeriod ||
      basePeriod.family !== offerPeriod.family
    ) {
      return { isFree: false, currency };
    }
    const prorated = (baseMicros * offerPeriod.count) / basePeriod.count;
    const discounted =
      discount != null ? prorated * discount : prorated - absoluteMicros!;
    const digits =
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2;
    const billableMicros = 10 ** (6 - digits);
    const priceAmountMicros =
      Math.round(discounted / billableMicros) * billableMicros;
    if (!Number.isSafeInteger(priceAmountMicros) || priceAmountMicros <= 0) {
      throw new Error("Invalid discounted Play offer phase price");
    }
    return { isFree: false, priceAmountMicros, currency };
  }

  const out: ProductOffer[] = [];
  for (const plan of sub.basePlans ?? []) {
    if (!plan.basePlanId || plan.state !== "ACTIVE") continue;
    const planRegions = (plan.regionalConfigs ?? []).filter(
      (region) => region.newSubscriberAvailability === true,
    );
    const planPrice = pickPlayRegionalPrice(
      planRegions
        .filter((region) => region.price)
        .map((region) => ({
          regionCode: region.regionCode,
          currencyCode: region.price?.currencyCode,
          price: region.price,
        })),
      preferredCurrency,
    )?.price;
    out.push({
      id: plan.basePlanId,
      kind: "BasePlan",
      duration:
        plan.autoRenewingBasePlanType?.billingPeriodDuration ??
        plan.installmentsBasePlanType?.billingPeriodDuration ??
        plan.prepaidBasePlanType?.billingPeriodDuration ??
        undefined,
      priceAmountMicros: moneyToMicros(planPrice),
      currency: planPrice?.currencyCode ?? undefined,
    });
    for (const offer of subscriptionOffers) {
      if (
        offer.productId !== sub.productId ||
        offer.basePlanId !== plan.basePlanId ||
        !offer.offerId ||
        offer.state !== "ACTIVE"
      )
        continue;
      for (const [index, phase] of (offer.phases ?? []).entries()) {
        const candidates = (phase.regionalConfigs ?? [])
          .filter(
            (region) =>
              planRegions.some(
                (base) => base.regionCode === region.regionCode,
              ) &&
              offer.regionalConfigs?.some(
                (availability) =>
                  availability.regionCode === region.regionCode &&
                  availability.newSubscriberAvailability === true,
              ),
          )
          .map((region) => ({
            regionCode: region.regionCode,
            currencyCode:
              region.price?.currencyCode ??
              planRegions.find((base) => base.regionCode === region.regionCode)
                ?.price?.currencyCode,
            region,
          }));
        const selected = pickPlayRegionalPrice(candidates, preferredCurrency);
        if (!selected) continue;
        const { isFree, priceAmountMicros, currency } = phasePrice(
          plan,
          phase,
          selected.region,
        );
        out.push({
          id: `${plan.basePlanId}/${offer.offerId}#${index}`,
          kind: isFree
            ? "FreeTrial"
            : (phase.recurrenceCount ?? 1) > 1
              ? "IntroPayAsYouGo"
              : "IntroPayUpFront",
          duration: phase.duration ?? undefined,
          numberOfPeriods: phase.recurrenceCount ?? undefined,
          priceAmountMicros,
          currency,
        });
      }
    }
  }
  return out;
}

/** Fetch the complete app offer catalog before writing any subscription rows. */
export async function listPlaySubscriptionOffers(
  androidpublisher: androidpublisher_v3.Androidpublisher,
  packageName: string,
  checkCancelled: () => Promise<void>,
): Promise<Map<string, androidpublisher_v3.Schema$SubscriptionOffer[]>> {
  const byProduct = new Map<
    string,
    androidpublisher_v3.Schema$SubscriptionOffer[]
  >();
  let pageToken: string | undefined;
  for (let page = 0; page < 50; page += 1) {
    await checkCancelled();
    const response =
      await androidpublisher.monetization.subscriptions.basePlans.offers.list({
        packageName,
        productId: "-",
        basePlanId: "-",
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
      });
    for (const offer of response.data.subscriptionOffers ?? []) {
      if (!offer.productId || !offer.basePlanId) {
        throw new Error("Play offer is missing its product or base-plan ID");
      }
      const offers = byProduct.get(offer.productId) ?? [];
      offers.push(offer);
      byProduct.set(offer.productId, offers);
    }
    pageToken = response.data.nextPageToken ?? undefined;
    if (!pageToken) return byProduct;
  }
  throw new Error("Play offer pagination exceeded 50 pages");
}

/**
 * Converts a Google `Money` into kit's integer micros.
 *
 * BigInt math, since `units` is a BigInt string. Nanos are truncated, not
 * rounded (rounding would turn 999_999_999 nanos into an extra micro), which
 * matches how Play stores price points. Nanos-only is valid: proto3 JSON omits
 * a zero `units`, so $0.99 arrives that way.
 *
 * Returns `undefined` (price unknown) when both fields are missing, `units` is
 * not a non-negative decimal string, `nanos` is outside Money's int32 sub-unit
 * range, or the result is negative or above `Number.MAX_SAFE_INTEGER` (about
 * USD 9 billion).
 */
export function moneyToMicros(
  money: androidpublisher_v3.Schema$Money | undefined,
): number | undefined {
  if (money?.units == null && money?.nanos == null) return undefined;
  try {
    const unitsMicros = moneyUnitsToMicros(money.units ?? "0");
    if (unitsMicros === undefined) return undefined;
    const nanosMicros = moneyNanosToMicros(money.nanos);
    if (nanosMicros === undefined) return undefined;
    const microsBigInt = unitsMicros + nanosMicros;
    if (microsBigInt < 0n) return undefined;
    // `priceAmountMicros` is a double: past 2^53 - 1 it loses precision, so
    // report the price as unknown instead. Guards high-unit currencies like IDR
    // and KRW.
    if (microsBigInt > BigInt(Number.MAX_SAFE_INTEGER) || microsBigInt < 0n) {
      return undefined;
    }
    return Number(microsBigInt);
  } catch {
    return undefined;
  }
}

function microsToGoogleMoney(
  priceAmountMicros: number,
  currency: string,
): androidpublisher_v3.Schema$Money {
  return {
    currencyCode: currency,
    units: String(Math.trunc(priceAmountMicros / 1_000_000)),
    nanos: (priceAmountMicros % 1_000_000) * 1_000,
  };
}

function moneyUnitsToMicros(units: string): bigint | undefined {
  if (!/^\d+$/.test(units)) return undefined;
  return BigInt(units) * 1_000_000n;
}

function moneyNanosToMicros(
  nanos: number | null | undefined,
): bigint | undefined {
  if (nanos == null) return 0n;
  if (!Number.isInteger(nanos) || nanos < -999_999_999 || nanos > 999_999_999) {
    return undefined;
  }
  return BigInt(nanos) / 1_000n;
}

/**
 * Maps an ISO 8601 billing period (`P1W`, `P1M`, `P1Y`...) to a readable
 * basePlanId, which Play Console shows verbatim. Unknown periods map to
 * `"monthly"`.
 */
export function basePlanIdForPeriod(period: string | undefined): string {
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
