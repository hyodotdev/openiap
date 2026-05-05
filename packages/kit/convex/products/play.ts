"use node";
import { v } from "convex/values";
import { google } from "googleapis";
import type { androidpublisher_v3 } from "googleapis";

import { internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { coerceBillingPeriod } from "./sync";

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
        failures: result.failures,
        plannedWrites: result.plannedWrites,
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
  failures: ProductSyncFailure[];
  plannedWrites?: Array<{ productId: string; step: string; detail?: string }>;
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
  let pulled = 0;
  let pushed = 0;

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
            const listing = product.listings?.[0];
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
            const preferred =
              priceCandidates.find((p) => p.regionCode === "US") ??
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
            pickSubBasePlanPrice(sub);
          const offers = collectPlaySubscriptionOffers(sub);
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
            title: sub.listings?.[0]?.title ?? sub.productId,
            description: sub.listings?.[0]?.description ?? undefined,
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
            // monetization.subscriptions.patch (en-US listing only —
            // multi-language sync is a future feature). Base-plan
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
                detail: `${row.title} (en-US, storeRef=${row.storeRef})`,
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
                  "regionsVersion.version": "2022/01",
                  requestBody: {
                    productId: row.storeRef,
                    listings: [
                      {
                        languageCode: "en-US",
                        title: row.title,
                        description: row.description ?? row.title,
                      },
                    ],
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
            // One-time product: patch listings + price via the
            // legacy inappproducts.patch endpoint, which accepts a
            // partial body and merges it.
            if (dryRun) {
              plannedWrites.push({
                productId: row.productId,
                step: "patch in-app product",
                detail:
                  `${row.title} (en-US, storeRef=${row.storeRef})` +
                  (row.priceAmountMicros !== undefined && row.currency
                    ? ` · ${row.currency} ${(row.priceAmountMicros / 1_000_000).toFixed(2)}`
                    : ""),
              });
            } else {
              try {
                await androidpublisher.inappproducts.patch({
                  packageName,
                  sku: row.storeRef,
                  requestBody: {
                    packageName,
                    sku: row.storeRef,
                    purchaseType: "managedUser",
                    listings: {
                      "en-US": {
                        title: row.title,
                        description: row.description ?? row.title,
                      },
                    },
                    ...(row.priceAmountMicros !== undefined && row.currency
                      ? {
                          defaultPrice: {
                            priceMicros: String(row.priceAmountMicros),
                            currency: row.currency,
                          },
                        }
                      : {}),
                  },
                });
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
          const basePlanId = basePlanIdForPeriod(row.billingPeriod);
          if (dryRun) {
            plannedWrites.push({
              productId: row.productId,
              step: "create subscription",
              detail: `${row.title} · base plan ${basePlanId} · ${row.billingPeriod ?? "P1M"} · ${row.currency} ${(row.priceAmountMicros / 1_000_000).toFixed(2)} (US)`,
            });
            plannedWrites.push({
              productId: row.productId,
              step: "activate base plan",
              detail: basePlanId,
            });
          } else {
            await androidpublisher.monetization.subscriptions.create({
              packageName,
              productId: row.productId,
              // `regionsVersion` is required by the v3 API on every
              // create — pins the regional-pricing schema revision
              // (Google introduced `2022/01` when the regional-config
              // shape changed). The request 400s without it. The
              // googleapis SDK exposes this as a flat querystring
              // param (`regionsVersion.version`).
              "regionsVersion.version": "2022/01",
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
                    basePlanId,
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
                `${row.title} · ${row.type}` +
                (row.priceAmountMicros !== undefined && row.currency
                  ? ` · ${row.currency} ${(row.priceAmountMicros / 1_000_000).toFixed(2)}`
                  : " · no price set"),
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
                ...(row.priceAmountMicros !== undefined && row.currency
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
    failures,
    plannedWrites: dryRun ? plannedWrites : undefined,
  };
}

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
  // Prefer USD when any region offers it — it's the most universally
  // recognizable in a dashboard. The operator can edit per-region
  // prices in Play Console; this just picks a stable display value.
  const preferred =
    candidates.find((c) => c.price.currencyCode === "USD") ?? candidates[0];
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
// in Play Console) becomes a Free-Trial / IntroPay* row. Prefers USD
// regional price when present (mirrors `pickSubBasePlanPrice`'s
// rationale) so the dashboard shows a stable currency.
function collectPlaySubscriptionOffers(
  sub: androidpublisher_v3.Schema$Subscription,
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
 * up. Resolves to `undefined` when the input has no `units`, when the
 * BigInt parse throws (malformed `units` string), or when the resulting
 * micros exceed `Number.MAX_SAFE_INTEGER` (≈ USD 9 billion — kit treats
 * those rows as price-unknown rather than silently corrupting them).
 *
 * PR #124 (https://github.com/hyodotdev/openiap/pull/124) review fix.
 */
export function moneyToMicros(
  money: androidpublisher_v3.Schema$Money | undefined,
): number | undefined {
  if (!money?.units) return undefined;
  try {
    const microsBigInt =
      BigInt(money.units) * 1_000_000n + BigInt(money.nanos ?? 0) / 1_000n;
    // Drop values that exceed Number.MAX_SAFE_INTEGER. The schema
    // stores `priceAmountMicros` as a JS `number` (IEEE 754 double),
    // so anything above 2^53 - 1 would silently lose precision on
    // round-trip. In practice no realistic IAP price hits that bound
    // (it's ~9.0e15 micros = USD 9 billion), but for currencies with
    // very high unit values like IDR / KRW it's worth the explicit
    // guard rather than a silent corruption — kit treats the row as
    // "price unknown" and the dashboard surfaces that affordance.
    if (
      microsBigInt > BigInt(Number.MAX_SAFE_INTEGER) ||
      microsBigInt < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      return undefined;
    }
    return Number(microsBigInt);
  } catch {
    return undefined;
  }
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
