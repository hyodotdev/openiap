"use node";
import { v } from "convex/values";
import { google } from "googleapis";
import type { androidpublisher_v3 } from "googleapis";

import { internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
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

/**
 * Per-product upstream rejection reported back to the dashboard. Used
 * inside `pushSyncProductsGoogle`'s `failures` array; extracted so the
 * shape stays in lockstep across every site that pushes into it.
 */
export interface ProductSyncFailure {
  productId: string;
  reason: string;
}

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

/**
 * Pull, push, or two-way sync the project's product catalog with
 * Google Play's Android Publisher API.
 *
 * `direction = "pull"`: import every IAP / subscription that exists
 * upstream into kit. `direction = "push"`: promote every kit-side row
 * with `state: "Draft"` to Play. `direction = "both"` (default): pull
 * first, then push so the catalog converges.
 *
 * NOTE on action duration: same caveat as `pushSyncProductsAppleIOS`
 * — this handler walks the project's catalog sequentially with
 * per-page Promise.all fan-out. Convex actions have a 10-minute hard
 * ceiling. Typical commercial apps (<100 SKUs) finish well inside that
 * bound; catalogs >500 SKUs may need a batched + scheduler-chained
 * variant. Tracked as a follow-up.
 *
 * @returns Counts of `pulled` / `pushed` rows plus a `failures` list
 *          carrying per-product upstream rejection reasons so the
 *          dashboard can render them.
 */
// Worker that drives a single Google Play sync job. See the parallel
// docstring on `runProductSyncIOS` in `products/asc.ts` — same job
// lifecycle, same cancel-at-phase-boundary semantics.
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
      // enqueue routes purge-local jobs to a different worker; this
      // branch is unreachable in practice but narrows the type for
      // the call below.
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

// See parallel definitions in `products/asc.ts`. Kept inline here
// (rather than imported across modules) because both files declare
// `"use node"` and Convex treats the module boundary as the runtime
// boundary; importing this from a non-`"use node"` module would
// pull `googleapis` into the V8 isolate runtime (Gemini review on
// PR #127).
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
  // Same operator-must-finish concept as the iOS path's
  // AscManualReviewAction — the push succeeded but left upstream state
  // that needs a human in Play Console (issue #288: regional prices
  // couldn't be auto-converted, so the product is US-only until the
  // operator sets them). The productSyncJobs schema and dashboard
  // banner are already platform-agnostic, so this flows end-to-end.
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
  const dryRun = options.dryRun;
  const failures: ProductSyncFailure[] = [];
  // Same shape as the iOS sync — read-only preview accumulator. Each
  // upstream write the PUSH branch would have made gets pushed onto
  // this list instead, then surfaced through the toast / result
  // banner so the operator can verify base-plan duration, region
  // pricing, etc. before committing.
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
    //
    // ORDER MATTERS: hit the new monetization API first so its
    // USD-preferred regional price wins. The legacy
    // `inappproducts.list` only exposes a single `defaultPrice`
    // (whatever currency the merchant set in Play Console — often
    // their home currency) which made products like
    // `dev.hyo.martie.10bulbs` show up as "AED 3.89" on the
    // dashboard for an operator using a Korean Play Console where
    // AED happens to be a regional override. New endpoint runs
    // first; legacy only fills in skus the new endpoint missed.
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
      // Defensive guard: the new monetization API isn't surfaced in
      // any typed shape by `googleapis` yet, so we cast through
      // `unknown` and read the (possibly-missing) `onetimeproducts`
      // property. `androidpublisher.monetization` is documented but
      // could change shape in a future SDK release; failing soft
      // (treating it as "no monetization endpoint here") lets the
      // legacy `inappproducts.list` path below still pull what it
      // can instead of bailing the entire pull half-done. The
      // outer try/catch records the failure in the per-product
      // `failures` array so the operator sees something happened.
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
                    // Pricing lives DIRECTLY on the purchaseOption,
                    // NOT nested inside buyOption. The earlier shape
                    // (buyOption.regionalPricingAndAvailabilityConfigs)
                    // was wrong — every one-time product surfaced
                    // with no price because the lookup never matched.
                    regionalPricingAndAvailabilityConfigs?: Array<{
                      regionCode?: string;
                      // Google's enum: "AVAILABLE",
                      // "NO_LONGER_AVAILABLE", "AVAILABLE_IF_RELEASED".
                      // Stale rows from removed regions still ship
                      // back with a price attached, so without this
                      // field we'd happily display a price the
                      // operator turned off years ago.
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
            // Walk every purchaseOption × regionalPricingAndAvailabilityConfig
            // (pricing lives on the option, not inside buyOption).
            // Two filters before ranking:
            //   - drop regions explicitly NO_LONGER_AVAILABLE so we
            //     don't surface stale pricing the operator removed.
            //   - require the price to have a `units` field — Google
            //     ships zero-priced placeholder rows for some regions
            //     and they'd outrank real prices alphabetically.
            // Ranking: regionCode === "US" first (canonical kit
            // display currency, deterministically maps to USD),
            // then any USD-currency region (covers operators who
            // override the US region price into a non-USD currency
            // — rare but possible), then the first remaining region
            // alphabetically by currency for a stable result.
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
            // Prefer the currency the kit row already carries. Pushing
            // converts the operator's base price into every region, so
            // a US-first ranking would read back the converted dollar
            // amount and overwrite an authored KRW/JPY row with it —
            // and the next push would then convert from that already
            // converted number. First imports keep the US/USD ranking.
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
              // First import through the modern endpoint, which carries
              // no consumable flag — so the type below is a guess.
              // NonConsumable is the safe guess (consuming a
              // non-consumable would destroy a permanent entitlement),
              // but a guessed Consumable verifies as
              // PENDING_ACKNOWLEDGMENT instead of READY_TO_CONSUME, and
              // a client gating on that state reads it as a rejection
              // (issue #289). Say so rather than deciding silently.
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
              // The new API doesn't carry a "consumable vs.
              // non-consumable" distinction; Play tracks consumption
              // at purchase time. Preserve any kit-authored type so
              // pull-sync doesn't turn consumables into
              // non-consumables, and default only for first imports.
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

    // Legacy `inappproducts.list` runs SECOND so any sku already
    // surfaced by the new endpoint (with USD-preferred pricing) wins
    // via the dedupe set. Only skus invisible to the new endpoint
    // get filled in here with whatever `defaultPrice` the merchant
    // set in Play Console.
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
      // The legacy `inappproducts.list` endpoint is deprecated for
      // newer Play Console accounts and Google now responds with
      // "Please migrate to the new publishing API". That message is
      // expected — the new `monetization.onetimeproducts.list` call
      // above already covers this account — and surfacing it as a
      // failure produces a noisy red toast every Sync. Suppress it
      // when seen; surface anything else.
      const reason = error instanceof Error ? error.message : String(error);
      if (!/migrate to the new publishing API/i.test(reason)) {
        failures.push({
          productId: "(play list inappproducts)",
          reason,
        });
      }
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
          const { priceAmountMicros, currency, basePlanId } =
            pickSubBasePlanPrice(
              sub,
              existingCurrencyByProductId.get(sub.productId ?? ""),
            );
          const offers = collectPlaySubscriptionOffers(
            sub,
            existingCurrencyByProductId.get(sub.productId ?? ""),
          );
          // Pick the billingPeriod from the *same* base plan whose
          // price we just selected (`basePlanId` returned by
          // pickSubBasePlanPrice). If we can't find that exact plan
          // in `offers`, fall back to the first BasePlan row — but
          // this fallback only triggers when basePlanId is missing,
          // which means the subscription has no price at all.
          // Without the basePlanId match, mixed monthly + yearly
          // products would pair the yearly USD price with the
          // monthly duration and break MRR normalization.
          const billingPeriod = (
            basePlanId
              ? offers.find((o) => o.kind === "BasePlan" && o.id === basePlanId)
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
            state: "Active",
            billingPeriod: coerceBillingPeriod(billingPeriod),
            // Play has no first-class subscription "group" — base
            // plans on a single subscription product play that role,
            // and we surface them as `offers[].kind === "BasePlan"`
            // rows. Leave the ASC-only group fields unset.
            offers: offers.length ? offers : undefined,
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
        // When this row already has a storeRef from a prior partial
        // sync, run the appropriate update endpoint instead of the
        // create endpoint — Play returns 409 Conflict on
        // create-with-existing-productId and ASC's parity step
        // (asc.ts) does the same patch flow. Listings + price are
        // both safe to re-push idempotently. Without this, kit-side
        // edits made after the initial push would silently never
        // reach Play (PR #124
        // (https://github.com/hyodotdev/openiap/pull/124) review).
        if (row.storeRef) {
          // Track whether the patch step succeeded — only flip to
          // Ready when the upstream actually accepted our changes,
          // otherwise the row stays Draft and surfaces in the next
          // sync's drafts list for retry (PR #124
          // (https://github.com/hyodotdev/openiap/pull/124) review).
          let patchOk = true;
          if (row.type === "Subscription") {
            // Subscriptions: patch the listing via
            // monetization.subscriptions.patch (base listing plus every
            // locale on the row, merged over what Play has). Base-plan
            // price changes have to go through a separate
            // monetization.subscriptions.basePlans endpoint, so we
            // intentionally don't try to mutate price here; that
            // requires a deactivate+recreate flow Play doesn't allow
            // in a single call. The dashboard surfaces a hint when
            // the kit-side row has a different price than the
            // pulled row so the operator knows to do that step
            // manually.
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
                  // `regionsVersion` is required by the Play API on
                  // every patch/create — it pins the regional-pricing
                  // schema version (Google added the `2022/01` revision
                  // when they switched the regional config shape) and
                  // the request 400s without it. PR #124
                  // (https://github.com/hyodotdev/openiap/pull/124)
                  // review. The googleapis SDK exposes this as a flat
                  // querystring param (`regionsVersion.version`).
                  // This patch masks `listings` only and sends no
                  // prices, so no conversion has to be aligned with and
                  // the historical pin stays correct.
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
                // 404 = subscription was deleted upstream after our
                // last pull; surface as a failure so the operator
                // re-creates it. Anything else also surfaces.
                patchOk = false;
                failures.push({
                  productId: `${row.productId} (subscription patch)`,
                  reason:
                    error instanceof Error ? error.message : String(error),
                });
              }
            }
          } else {
            // One-time product: modern Play Console apps use
            // monetization.onetimeproducts, while older apps still
            // accept the legacy inappproducts endpoint. Prefer the
            // modern API and let the helper fall back when needed.
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
          // Reject subscription creates that would land on Play with
          // no base plan: such a subscription is created in a draft
          // state that the Play app cannot purchase, which silently
          // breaks the SDK's `requestPurchase` flow downstream. The
          // operator must provide both a price and currency at
          // minimum so we can synthesize a base plan. Validation
          // applies to dry-run too — we want the operator to see
          // this error before attempting a real sync.
          if (!row.priceAmountMicros || !row.currency) {
            throw new Error(
              "Subscription requires priceAmountMicros + currency to mint a Play base plan; otherwise the product will not be purchasable.",
            );
          }
          // Play's `regionalConfigs` requires the `currencyCode` to be
          // the local currency of the `regionCode` it's paired with, so
          // the base price can't simply be replicated across regions.
          // Ask Play to convert it (same mechanism the one-time path
          // uses) and write every region it returns — a base plan
          // created with a lone US config is unbuyable everywhere else
          // (issue #288). Conversion failure degrades to the base
          // region plus a manual action rather than a hard failure.
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
            // Conversion (and therefore the USD-fallback guard) runs
            // only on the real write path — a dry run must never fail a
            // non-USD subscription for a price it isn't going to send.
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
              // `regionsVersion` is required by the v3 API on every
              // create — pins the regional-pricing schema revision
              // (Google introduced `2022/01` when the regional-config
              // shape changed). The request 400s without it. The
              // googleapis SDK exposes this as a flat querystring
              // param (`regionsVersion.version`).
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
                // Auto-renewing base plan. Period from the catalog row;
                // defaults to monthly when the operator hasn't picked
                // one. The base-plan id mirrors the duration so a row
                // upgraded later from monthly→yearly doesn't collide
                // with an existing base plan id in Play Console.
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
            // Activate the just-created base plan. Play's v3 API
            // creates new base plans in DRAFT regardless of the
            // `state` field on the create payload — the SKU isn't
            // purchasable until `basePlans.activate` flips it to
            // ACTIVE. Without this call we'd mark the row Ready while
            // the upstream subscription is still non-purchasable
            // (PR #124 (https://github.com/hyodotdev/openiap/pull/124)
            // review).
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
          // Persist storeRef immediately after the create returns,
          // BEFORE flipping state to Ready via markPushed. If the
          // action times out / crashes between create and markPushed,
          // the next sync still sees this row's storeRef populated
          // and will skip the create call (avoiding 409 Conflict
          // from re-creating the same productId in Play). Mirrors the
          // partial-sync resilience pattern in pushSyncProductsAppleIOS.
          // Play's productId IS the storeRef (no separate opaque id).
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
 * Listings for a subscription patch, merged over what Play already has.
 *
 * `updateMask: "listings"` replaces the array, so a locale the operator
 * added in Play Console would be deleted by a push that sent only kit's
 * own set. Read errors propagate — the caller turns them into a per-row
 * failure and the row stays Draft for the next sync — because a partial
 * write here is destructive, not merely incomplete.
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

  // A read failure must NOT fall through to kit's own set: the patch
  // replaces the listings array, so writing an unmerged set would delete
  // exactly the upstream locales this read exists to protect. Surface it
  // and let the caller record a failure instead.
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
 * Human summary of what a push would publish.
 *
 * `withRegions` is false on paths that write listings only (the
 * subscription patch), so the preview never advertises a footprint that
 * write does not touch.
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
 * Play listing rows for a product: the base en-US listing plus every
 * locale the operator added, merged over whatever is already upstream.
 *
 * `updateMask` makes Play REPLACE the whole `listings` array, so a
 * locale an operator added directly in Play Console would be deleted by
 * a push that only knows kit's own set. Kit-authored locales win; the
 * rest are carried through untouched. (Consequence: removing a
 * localization in kit does not remove it from Play — delete it in Play
 * Console. Same trade the regional configs make.)
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

  // Base locale first: Play's legacy path needs `defaultLanguage` to
  // match a listing, and a store that treats the first entry as default
  // should get the language the operator actually authored.
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
    // Only the LEGACY path cannot honour a region footprint, so the
    // check belongs here — hoisting it above the modern attempt made
    // every footprint fail before Play was ever contacted. Round 5's
    // concern (a regions message hiding the real modern failure) is met
    // by carrying that failure into the text instead.
    assertLegacyPathUsableFor(args, error);

    if (options.allowCreate) {
      await insertLegacyAndroidOneTimeProduct(androidpublisher, args);
      return manualActions;
    }
    await patchLegacyAndroidOneTimeProduct(androidpublisher, args);
    return manualActions;
  }

  // Activation errors describe the modern product we just upserted and must
  // not be reclassified as evidence that the product belongs to the legacy
  // catalog.
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
 * Asks Play to convert one base price into every region it sells in.
 *
 * Play has no `autoConvertMissingPrices` equivalent on the modern
 * one-time-product API, so the only way to publish a product that is
 * buyable outside the base region is to call this first and write every
 * returned region explicitly (issue #288). A failure degrades to a
 * single-region write plus a manual action rather than failing the whole
 * push, so the reason is carried out for the operator — "conversion
 * unavailable" and "your service account lacks pricing permission" need
 * very different responses.
 */
/**
 * Number of regions Play actually returned a usable price for.
 *
 * `convertedRegionPrices` is an object, so a bare truthiness check
 * treats `{}` — Play answering with no conversions at all — as success
 * and ships the product US-only while reporting a clean sync. Every
 * decision that depends on "did conversion work" must go through this.
 */
/**
 * Regions version to write a resource at.
 *
 * `convertRegionPrices` always converts using Play's CURRENT region
 * definitions, but a write is validated against whatever version the
 * request pins. Pinning an older version than the conversion used makes
 * Play reject the write for any region whose currency changed since —
 * e.g. Bulgaria moved from BGN to EUR, and a 2022/01 write of a
 * freshly-converted EUR price fails with "Expected BGN but got EUR".
 * So the write follows the conversion's own version, falling back to the
 * historical pin when there is no conversion to align with.
 */
const FALLBACK_REGIONS_VERSION = "2022/01";

function regionsVersionFor(
  converted: androidpublisher_v3.Schema$ConvertRegionPricesResponse | undefined,
  existingVersion?: string,
): string {
  // The conversion's own version wins. Failing that, the write still
  // echoes the configs Play generated at `existingVersion`, and pinning
  // anything older makes Play reject them for the same reason a
  // freshly-converted price fails at 2022/01 — a region whose currency
  // changed since. The historical pin is only for a product Play has
  // never priced.
  return (
    converted?.regionVersion?.version ??
    existingVersion ??
    FALLBACK_REGIONS_VERSION
  );
}

function convertedRegionCount(
  converted: androidpublisher_v3.Schema$ConvertRegionPricesResponse | undefined,
): number {
  return Object.values(converted?.convertedRegionPrices ?? {}).filter(
    (region) => region.price,
  ).length;
}

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
 * Builds the regional pricing rows for a purchase option.
 *
 * `existingByRegion` carries the product's current configs on an update.
 * In inherit mode, only those regions are repriced and their availability
 * stays unchanged. An explicit list or `"all"` may reactivate a withdrawn
 * region because that is an operator-authored footprint change.
 *
 * When conversion is unavailable there is no legal price for a foreign
 * region (Play pairs each region with its own currency), so the base
 * amount is written to the regions that already use the base currency
 * and every other region keeps its previous price. `repriced` reports
 * how many regions actually took the new amount so the caller can say
 * plainly that the rest did not.
 */
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
    // Play refuses to drop a region once a purchase option has it
    // ("Cannot remove region once it has been added"), so an excluded
    // region can only be withdrawn, never omitted — and a region the
    // product doesn't have yet is simply not added.
    if (allowedRegions && !allowedRegions.has(regionCode)) {
      if (!existing) continue;
      configs.set(regionCode, {
        ...withdrawRegion(existing),
        // The PATCH is pinned to the conversion's current regions version.
        // Echoing an old config's price can pair a retired currency (for
        // example BGN) with the new version that now requires EUR, even
        // though the region is being withdrawn.
        price: regionPrice.price,
      });
      continue;
    }
    configs.set(regionCode, {
      regionCode,
      // Play rejects a config that pairs a region with a currency that
      // isn't its own, so the converted Money is the only safe price
      // here — never the operator's base-currency amount.
      price: regionPrice.price,
      // A region kit itself withdrew must come back when the operator
      // explicitly adds it to a list or selects `"all"`; otherwise the
      // footprint would be a one-way door. In inherit mode, preserve the
      // availability Play returned so a price-only push cannot reopen a
      // market the operator withdrew in Play Console.
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
    // Without a conversion the new amount is still legal in any region
    // already denominated in the base currency. Writing it there keeps
    // a price edit from being silently dropped on the degraded path.
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
    // Nothing to preserve and no conversion — fall back to the base
    // region so the product is at least purchasable somewhere. The
    // caller reports this as a manual action rather than a silent
    // success. An operator who named their regions and left US out must
    // not have it published anyway; there is simply nothing legal to
    // write for them, so the push fails and says why.
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
 * Guards the single-region fallback used when Play's price conversion is
 * unavailable.
 *
 * Play requires a region's config to carry that region's own currency,
 * so only a USD price may be published to the US fallback. A non-USD
 * price would 400 with a generic message; fail here instead with one
 * that says what to do. (Before issue #288 this constraint was enforced
 * by rejecting every non-USD product outright — now it only applies on
 * the degraded path, because conversion normally supplies each region's
 * local currency.)
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
 * Regional base-plan configs for a subscription create.
 *
 * Same contract as {@link buildRegionalPricingConfigs} minus the merge
 * arm: `subscriptions.create` only ever runs for a subscription that
 * doesn't exist upstream yet, so there is nothing to preserve.
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
        // Spread the upstream option first so fields kit doesn't model
        // — offerTags, taxAndComplianceSettings, an operator-configured
        // newRegionsConfig — survive; the keys below then assert what
        // kit does own. `state` is output-only and must not be echoed.
        ...stripReadOnlyPurchaseOptionFields(existing.buyOption),
        purchaseOptionId: "buy",
        buyOption: {
          legacyCompatible: true,
          multiQuantityEnabled: false,
        },
        regionalPricingAndAvailabilityConfigs,
        ...(newRegionsConfig ? { newRegionsConfig } : {}),
      },
      // kit only models the single `buy` option, but `updateMask:
      // "purchaseOptions"` replaces the whole list — so anything the
      // operator added in Play Console (a rent option, a second buy
      // option, a pre-order offer) has to be echoed back or the push
      // deletes it. Same replace-semantics trap as the regional configs.
      ...existing.otherPurchaseOptions.map((option) =>
        stripReadOnlyPurchaseOptionFields(option),
      ),
    ],
  };
}

/**
 * Drops output-only fields Play rejects on write.
 *
 * `state` is documented as output-only ("This field cannot be changed by
 * updating the resource"), so echoing a read-back option verbatim would
 * turn a preservation write into a 400.
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
 * Reads the product's current purchase options.
 *
 * `updateMask: "purchaseOptions"` makes Play REPLACE the repeated field,
 * so an update that doesn't first read what's there wipes both the
 * regions and the purchase options it omits. Returns empty state when
 * the product doesn't exist yet — the caller then treats it as a create.
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

  // Read before write: `updateMask: "purchaseOptions"` replaces the
  // repeated field wholesale, so an update that skipped this would strip
  // every region the operator has configured in Play Console. The read
  // also runs on the create path — `allowMissing` upserts, so a "create"
  // can land on a product that already exists (retry after a partial
  // sync) and must not flatten it either.
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
  // Three states, and the difference between the last two is the whole
  // point of this block:
  //
  //   ["US","KR"] — an explicit footprint. Everything else is withdrawn.
  //   "all"       — sell wherever Play prices. Expands on purpose.
  //   unset       — inherit. A product Play has never seen goes out
  //                 everywhere (Play Console's own default, and the fix
  //                 for #288); one that already exists keeps the exact
  //                 regions it has and is only repriced.
  //
  // That last case is why `unset` is not simply "all": pushing an
  // existing US-only product would otherwise expand it to every market
  // Play prices, on a sync the operator ran to change a price. Nothing
  // is withdrawn here — the excluded regions have no config to withdraw,
  // so the footprint branch below skips them.
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

  // "Other regions" pricing covers markets Play launches later. Play
  // requires both USD and EUR here, so it only goes out when the
  // conversion supplied both.
  // Two rules meet here. Without a footprint, per-region availability is
  // preserved, so this has to be too: an operator who withdrew "other
  // regions" in Play Console has said "do not follow Play into new
  // markets", and re-pricing must not silently opt them back in — only
  // the amounts are refreshed. With an explicit footprint it has to be
  // OFF, and merely omitting it is not enough, because the existing
  // purchase option is spread into the write and would carry a
  // previously-enabled config forward. It has to be actively withdrawn.
  const existingNewRegions = existing.buyOption?.newRegionsConfig;
  const otherRegions = explicitFootprint
    ? undefined
    : // Inheriting: refresh the amounts if Play already follows new
      // markets for this product, but never switch that on. Creating it
      // here would opt an existing product into every market Play
      // launches from now on — the same silent expansion the inherited
      // footprint exists to prevent, just deferred.
      inheritedFootprint && !existingNewRegions
      ? undefined
      : converted?.convertedOtherRegionsPrice;
  const newRegionsConfig =
    otherRegions?.usdPrice && otherRegions.eurPrice
      ? {
          // `"all"` is an explicit request to follow Play into future
          // markets, so it reactivates a previously withdrawn config.
          // Inherit mode preserves the operator's Play Console choice.
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
        : // Explicit, not omitted: `undefined` would rely on the spread
          // carrying the old value, which is the same reasoning that
          // makes the withdrawal above necessary. Only an explicit
          // footprint withdraws — inheriting leaves the operator's own
          // Play Console setting exactly as it is.
          existingNewRegions;

  // The generated method owns the PATCH route. In googleapis v157 the
  // upsert route is the lowercase `/onetimeproducts/{productId}` path,
  // which differs from the camel-case routes used by sibling methods.
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

  // Availability is optional in Play's schema and absent means
  // AVAILABLE, so both the stale count and the unpriced check go through
  // one predicate rather than testing the string directly. It is a
  // NOT-withdrawn test, not an equals-AVAILABLE one: a region priced
  // ahead of release comes back as AVAILABLE_IF_RELEASED and is still a
  // region the product is sold in. Reading it as "not live" made the
  // stale count disagree with the configs it was counting.
  const isLive = (
    config: androidpublisher_v3.Schema$OneTimeProductPurchaseOptionRegionalPricingAndAvailabilityConfig,
  ) =>
    (config.availability ?? "AVAILABLE") !== "NO_LONGER_AVAILABLE" &&
    !(allowedRegions && !allowedRegions.has(config.regionCode ?? ""));

  // A requested region Play returned no price for is silently absent
  // from the write, so say so. This backstops the region-code validator:
  // a code that is well-formed and assigned but not a Play sales region
  // reaches here rather than disappearing.
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

  // Both numbers must come from the SAME set of final configs. Mixing a
  // filtered numerator with an unfiltered counter made `stale` go
  // negative when a withdrawn region happened to be repriced, which
  // silently dropped the whole warning.
  const live = regionalConfigs.filter(isLive);
  const applied = live.filter((config) =>
    repricedRegions.has(config.regionCode ?? ""),
  ).length;
  const stale = live.length - applied;

  // Inheriting a narrow footprint is the safe choice, not necessarily
  // the intended one — an operator whose product is US-only because of
  // the bug this release fixes would otherwise never find out. Say how
  // many markets are being left on the table, once the numbers are known
  // to be real (a failed conversion knows nothing about availability).
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
    // Conversion worked; what is left worth saying is whether a
    // requested region has no Play price, and whether kit declined to
    // expand. Reported as its own action rather than short-circuiting
    // the conversion-failure report below.
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

  // Conversion failed. The write still went out, but only `applied` of
  // the product's live regions could legally take the new amount — the
  // rest kept their previous prices. Report exactly that; "pushed, no
  // failures" would read as "the new price is live everywhere".
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
 * Legacy `inappproducts` keeps listings as a locale-keyed map rather
 * than an array. `defaultLanguage` must name one of these keys, which
 * the base locale always satisfies.
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

/**
 * The legacy `inappproducts` API has no region concept — it prices a SKU
 * from `defaultPrice` and, with `autoConvertMissingPrices`, everywhere
 * else. An operator who named their sales regions cannot be served by
 * it, and silently publishing everywhere would be the opposite of what
 * they asked for. Raised before the modern attempt so a genuine modern
 * failure is reported as itself.
 */
/** Message for an unknown upstream throwable, without "[object Object]". */
function describeUpstreamError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "an unknown error";
}

export function assertLegacyPathUsableFor(
  args: AndroidOneTimeProductUpsertArgs,
  modernError?: unknown,
): void {
  // "all" is not a footprint the legacy API cannot honour — it prices
  // every region, which is exactly what "all" asks for. Only an explicit
  // list has no legal expression there.
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
    // Without this the legacy API prices the SKU in the merchant
    // currency only and leaves every other region unbuyable — the
    // legacy-path half of issue #288.
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

  // An update may target a SKU that exists only in the legacy catalog, so a
  // modern 404 must retain the established legacy-patch compatibility path.
  // A create uses allowMissing=true; its bare 404 cannot mean "product absent"
  // and must remain visible instead of being masked by a legacy insert.
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
/**
 * Chooses which region's price represents a pulled one-time product.
 *
 * Preference order, and why each step exists:
 *   1. the authored currency in the US region, then anywhere — pushing
 *      converts the operator's base price into every region, so a
 *      US-first rule would read a KRW/JPY row back as its converted
 *      dollar amount and the next push would convert from that already
 *      converted number;
 *   2. US, then any USD region — Play prices several non-US regions in
 *      USD (EC, SV, TL, ZW…), so matching on currency alone would
 *      resolve a plain USD row to whichever of those Play listed first;
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

export function pickSubBasePlanPrice(
  sub: androidpublisher_v3.Schema$Subscription,
  preferredCurrency?: string,
): {
  priceAmountMicros?: number;
  currency?: string;
  // The basePlanId of the plan whose price we picked, so the caller
  // can pull `billingPeriod` from the *same* plan instead of guessing
  // (PR #124 (https://github.com/hyodotdev/openiap/pull/124) review:
  // mixed monthly + yearly base plans previously paired the yearly
  // USD price with the monthly billingPeriod, breaking MRR
  // normalization).
  basePlanId?: string;
} {
  type Candidate = {
    price: androidpublisher_v3.Schema$Money;
    basePlanId?: string;
  };
  const candidates: Candidate[] = [];
  for (const plan of sub.basePlans ?? []) {
    const basePlanId = plan.basePlanId ?? undefined;
    for (const region of plan.regionalConfigs ?? []) {
      if (region.price) candidates.push({ price: region.price, basePlanId });
    }
  }
  if (candidates.length === 0) return {};
  // Prefer the currency the kit row already carries. Pushing converts
  // the operator's base price into every region, so a USD-first rule
  // would read a KRW/JPY-authored row back as its converted dollar
  // amount and the next push would convert from that already-converted
  // number. Falls back to USD — the most universally recognizable
  // dashboard value — for rows kit hasn't priced yet.
  const preferred =
    (preferredCurrency
      ? candidates.find((c) => c.price.currencyCode === preferredCurrency)
      : undefined) ??
    candidates.find((c) => c.price.currencyCode === "USD") ??
    candidates[0];
  return {
    priceAmountMicros: moneyToMicros(preferred.price),
    currency: preferred.price.currencyCode ?? undefined,
    basePlanId: preferred.basePlanId,
  };
}

// Flatten a Play subscription's basePlans + (per base plan) offers
// into kit's uniform `offers[]` shape. Each base plan becomes a
// `kind: "BasePlan"` row carrying its billing period + USD price; each
// associated subscription offer (free trial / intro discount, set up
// in Play Console) becomes a Free-Trial / IntroPay* row. Prefers the
// currency the kit row already carries, then USD, so a KRW/JPY-authored
// subscription doesn't show its base plan in one currency and its
// offers in another.
function collectPlaySubscriptionOffers(
  sub: androidpublisher_v3.Schema$Subscription,
  preferredCurrency?: string,
): Array<{
  id: string;
  kind:
    | "BasePlan"
    | "FreeTrial"
    | "IntroPayUpFront"
    | "IntroPayAsYouGo"
    | "PromotionalOffer";
  duration?: string;
  numberOfPeriods?: number;
  priceAmountMicros?: number;
  currency?: string;
}> {
  const out: Array<{
    id: string;
    kind:
      | "BasePlan"
      | "FreeTrial"
      | "IntroPayUpFront"
      | "IntroPayAsYouGo"
      | "PromotionalOffer";
    duration?: string;
    numberOfPeriods?: number;
    priceAmountMicros?: number;
    currency?: string;
  }> = [];
  // Local shape for `basePlans[].offers[]` — googleapis' generated
  // `Schema$BasePlan` doesn't expose offers despite the underlying
  // REST resource carrying them, and we don't want to depend on the
  // SDK regenerating to surface this. Mirrors the relevant fields
  // from Play's `SubscriptionOffer` proto.
  type PlanOfferShape = {
    offerId?: string;
    phases?: Array<{
      duration?: string;
      recurrenceCount?: number;
      regionalConfigs?: Array<{
        regionCode?: string;
        price?: androidpublisher_v3.Schema$Money;
      }>;
    }>;
  };
  type PlanWithOffers = androidpublisher_v3.Schema$BasePlan & {
    offers?: PlanOfferShape[];
  };
  for (const plan of (sub.basePlans ?? []) as PlanWithOffers[]) {
    if (!plan.basePlanId) continue;
    const planRegions = plan.regionalConfigs ?? [];
    const planPrice =
      (preferredCurrency
        ? planRegions.find((r) => r.price?.currencyCode === preferredCurrency)
            ?.price
        : undefined) ??
      planRegions.find((r) => r.price?.currencyCode === "USD")?.price ??
      planRegions[0]?.price;
    out.push({
      id: plan.basePlanId,
      kind: "BasePlan",
      duration:
        plan.autoRenewingBasePlanType?.billingPeriodDuration ?? undefined,
      priceAmountMicros: moneyToMicros(planPrice ?? undefined),
      currency: planPrice?.currencyCode ?? undefined,
    });
    for (const offer of plan.offers ?? []) {
      if (!offer.offerId) continue;
      // Walk the offer's phases. A FREE phase becomes FreeTrial; a
      // DISCOUNTED phase with a single occurrence becomes
      // IntroPayUpFront; multi-occurrence becomes IntroPayAsYouGo.
      // Most offers only have one of these; if multiple, we emit
      // multiple rows tagged with the same composite id so the
      // dashboard can dedupe by basePlanId+offerId+phaseIndex.
      const phases = offer.phases ?? [];
      phases.forEach((phase, i) => {
        const phaseRegions = phase.regionalConfigs ?? [];
        const phasePrice =
          (preferredCurrency
            ? phaseRegions.find(
                (r) => r.price?.currencyCode === preferredCurrency,
              )?.price
            : undefined) ??
          phaseRegions.find((r) => r.price?.currencyCode === "USD")?.price ??
          phaseRegions[0]?.price;
        // Phase with no price = free trial; with `recurrenceCount > 1`
        // = pay-as-you-go intro; otherwise = pay-up-front intro.
        let kind: "FreeTrial" | "IntroPayUpFront" | "IntroPayAsYouGo" =
          "FreeTrial";
        const isFree =
          !phasePrice ||
          (phasePrice.units === "0" && (phasePrice.nanos ?? 0) === 0);
        if (!isFree) {
          kind =
            (phase.recurrenceCount ?? 1) > 1
              ? "IntroPayAsYouGo"
              : "IntroPayUpFront";
        }
        out.push({
          id: `${plan.basePlanId}/${offer.offerId}#${i}`,
          kind,
          duration: phase.duration ?? undefined,
          numberOfPeriods: phase.recurrenceCount ?? undefined,
          priceAmountMicros: isFree ? undefined : moneyToMicros(phasePrice),
          currency: isFree
            ? undefined
            : (phasePrice?.currencyCode ?? undefined),
        });
      });
    }
  }
  return out;
}

/**
 * Convert a Google `Money` proto into the integer micros (1/1,000,000
 * of the currency unit) representation kit stores on every product row.
 *
 * `units` is a BigInt-as-string in the Play proto, so the micros
 * multiplication is done in BigInt to avoid IEEE 754 precision loss on
 * large currency values (>2^53). The nanos → micros conversion is
 * BigInt division which truncates (not `Math.round`, which would push
 * `999_999_999` nanos up to a full 1_000_000 micros and silently add 1
 * micro to sub-unit prices). Truncation matches how Google Play Console
 * stores price points internally — Play uses micros as the canonical
 * unit, so any rounding here would re-introduce drift we just cleaned
 * up. Resolves to `undefined` when the input has neither `units` nor
 * `nanos` (proto3 JSON omits a zero `units`, so a sub-unit price like $0.99
 * arrives as nanos-only), when the `units` is not a non-negative decimal
 * string, when the result is negative, when `nanos` falls outside
 * Google Money's int32 sub-unit range, or when the resulting micros exceed
 * `Number.MAX_SAFE_INTEGER` (≈ USD 9 billion — kit treats those rows as
 * price-unknown rather than silently corrupting them).
 *
 * PR #124 (https://github.com/hyodotdev/openiap/pull/124) review fix.
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
    // Drop values that exceed Number.MAX_SAFE_INTEGER. The schema
    // stores `priceAmountMicros` as a JS `number` (IEEE 754 double),
    // so anything above 2^53 - 1 would silently lose precision on
    // round-trip. In practice no realistic IAP price hits that bound
    // (it's ~9.0e15 micros = USD 9 billion), but for currencies with
    // very high unit values like IDR / KRW it's worth the explicit
    // guard rather than a silent corruption — kit treats the row as
    // "price unknown" and the dashboard surfaces that affordance.
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
 * Map an ISO 8601 billing-period string (`P1W` / `P1M` / `P1Y` / etc.)
 * to a stable, descriptive basePlanId for the Play console. Play's
 * product detail page surfaces this id verbatim, so "yearly" /
 * "weekly" reads better than the default "monthly" hardcoded fallback
 * we used before. Unknown / undefined periods collapse to `"monthly"`.
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
