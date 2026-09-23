"use node";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { action, internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { getProjectByApiKey } from "../purchases/shared";
import { mapWithConcurrency } from "../utils/concurrency";
import { validateAppleReviewScreenshotContent } from "../files/validation";
import { mintAscJwt } from "./jwt";
import { listingRowsForProduct, splitStoreListings } from "./localizations";
import { coerceBillingPeriod } from "./sync";
import {
  isProductSyncDeadlineReached,
  truncateManualActions,
  truncatePlannedWrites,
} from "./syncResult";
import {
  ascReviewLocalizationMismatch,
  ASC_REVIEW_SUBMISSION_ITEM_LIMIT,
  ASC_REVIEW_SYNC_BATCH_LIMIT,
  ensureAscReviewVersion,
  getAscReviewEligibilityActions,
  isAscApprovedReviewHistoryState,
  inspectAscReviewVersion,
  planAscReviewVersion,
  readAscReviewListings,
  partitionAscReviewSubmissionItems,
  submitAscReviewVersions,
  uploadAscReviewScreenshot,
  upsertAscReviewLocalization,
  type AscJsonRequest,
  type AscReviewEligibilitySnapshot,
  type AscManualReviewAction,
  type AscReviewScreenshot,
  type AscReviewSubmissionOutcome,
  type AscReviewVersionItem,
} from "./ascReview";

// Shared cancellation/deadline signal. The worker checks at phase and chunk
// boundaries, AscClient checks before every API request, and the review helper
// checks between upload operations and asset-delivery polls.
export class ProductSyncCancelledError extends Error {
  constructor() {
    super("Sync cancelled by operator");
    this.name = "ProductSyncCancelledError";
  }
}

class ProductSyncDeadlineError extends Error {
  constructor() {
    super("Product sync reached its runtime deadline; retry to continue");
    this.name = "ProductSyncDeadlineError";
  }
}

/**
 * Upserts one ASC localization per locale; Apple keeps a resource per locale,
 * so a locale added in ASC is left alone.
 *
 * A base-listing error propagates so the caller's replay handling applies.
 * Later locales fail one at a time and name themselves, so one bad translation
 * does not strand the rest. Cancellation and deadline errors always propagate.
 */
export async function pushAscReviewLocalizations(args: {
  listings: Array<{ locale: string; title: string; description?: string }>;
  productId: string;
  upsert: (listing: {
    locale: string;
    title: string;
    description?: string;
  }) => Promise<void>;
  recordFailure: (failure: { productId: string; reason: string }) => void;
}): Promise<void> {
  for (const [index, listing] of args.listings.entries()) {
    if (index === 0) {
      await args.upsert(listing);
      continue;
    }
    try {
      await args.upsert(listing);
    } catch (error) {
      if (isProductSyncAbortError(error)) throw error;
      if (isBenignAscRetryConflict(error)) continue;
      args.recordFailure({
        productId: `${args.productId} (localization ${listing.locale})`,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

interface SyncAscReviewLocalizationArgs {
  reviewVersion: {
    versionId: string;
    alreadySubmitted: boolean;
    attachedToSubmission: boolean;
  };
  listings: Array<{ locale: string; title: string; description?: string }>;
  productId: string;
  findMismatchedLocale: () => Promise<string | undefined>;
  upsert: (listing: {
    locale: string;
    title: string;
    description?: string;
  }) => Promise<void>;
  recordFailure: (failure: { productId: string; reason: string }) => void;
}

/**
 * Syncs review localizations for one ASC version and owns the failure policy.
 * Cancellation and deadline errors can come from either layer, so they escape
 * before replay conflicts or other failures are handled.
 */
export async function syncAscReviewLocalization(
  args: SyncAscReviewLocalizationArgs,
): Promise<void> {
  try {
    if (
      args.reviewVersion.alreadySubmitted ||
      args.reviewVersion.attachedToSubmission
    ) {
      const mismatchedLocale = await args.findMismatchedLocale();
      if (mismatchedLocale) {
        args.recordFailure({
          productId: `${args.productId} (review version)`,
          reason: `The current ASC review version is already attached or submitted and its ${mismatchedLocale} metadata differs from this Draft. Finish or cancel that review in App Store Connect, then run Push Sync again to create an editable version.`,
        });
      }
      return;
    }
    await pushAscReviewLocalizations({
      listings: args.listings,
      productId: args.productId,
      upsert: args.upsert,
      recordFailure: args.recordFailure,
    });
  } catch (error) {
    if (isProductSyncAbortError(error)) throw error;
    // A 409 on an editable version is a benign replay from a partial prior
    // sync. Reads/comparisons against attached versions are never treated as
    // replay success.
    if (
      args.reviewVersion.alreadySubmitted ||
      args.reviewVersion.attachedToSubmission ||
      !isBenignAscRetryConflict(error)
    ) {
      args.recordFailure({
        productId: `${args.productId} (localization)`,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function isProductSyncAbortError(error: unknown): boolean {
  return (
    error instanceof ProductSyncCancelledError ||
    error instanceof ProductSyncDeadlineError
  );
}

// App Store Connect credentials for a project: the ASC key pair when set, never
// mixed with the legacy Server API pair. Throws an operator-facing message when
// the key id or .p8 is missing.
type AscCredentials = {
  issuerId?: string;
  keyId: string;
  keyContent: string;
};
async function resolveAscCredentials(
  ctx: ActionCtx,
  project: Doc<"projects">,
  options: { detailedErrors?: boolean } = {},
): Promise<AscCredentials> {
  // Apple has one Issuer ID per team for both gateways, so the UI writes a
  // single shared `iosAppStoreIssuerId`; `iosAscIssuerId` is left over from
  // when they were separate inputs. Key IDs differ: `iosAppStoreKeyId` is the
  // In-App Purchase key (receipt verification), `iosAscKeyId` the ASC API
  // Team/Individual key (catalog management).
  //
  // With `iosAscKeyId` set, sign with the ASC pair; otherwise use the legacy
  // Server API pair so projects mid-migration still work, and `call()` hints at
  // the wrong key kind on a 401. Do not also require `iosAscIssuerId`: the UI
  // never sets it.
  const useAsc = !!project.iosAscKeyId;
  const issuerId = useAsc
    ? (project.iosAscIssuerId ?? project.iosAppStoreIssuerId)
    : project.iosAppStoreIssuerId;
  const keyId = useAsc ? project.iosAscKeyId : project.iosAppStoreKeyId;
  if (!keyId) {
    const missing = [useAsc ? "iosAscKeyId" : "iosAppStoreKeyId"];
    throw new Error(
      options.detailedErrors
        ? `App Store Connect API ${missing.join(", ")} not configured. ` +
            "Generate them at App Store Connect → Users and Access → " +
            "Integrations → App Store Connect API (NOT under In-App " +
            "Purchase — those credentials are scoped to receipt " +
            "verification only). Save them in Settings → iOS " +
            "Configuration → 'App Store Connect API (push-sync)'."
        : `App Store Connect API ${missing.join(", ")} not configured`,
    );
  }
  // Dedicated ASC .p8 first, else the Server API one; `call()`'s 401 hint
  // covers the wrong kind.
  let keyContent: string | undefined;
  try {
    const ascKey = await ctx.runAction(
      internal.files.internal.getAppleAscApiKey,
      {
        organizationId: project.organizationId,
        projectId: project._id,
      },
    );
    keyContent = ascKey?.keyContent;
  } catch (error) {
    // Only a missing ASC key falls through to the legacy slot. Any other error
    // would end up signing with the wrong key and surface as a confusing 401.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("No App Store Connect API key (.p8) uploaded")) {
      throw error;
    }
  }
  if (!keyContent) {
    const legacyKey = await ctx.runAction(
      internal.files.internal.getAppleP8Key,
      {
        organizationId: project.organizationId,
        projectId: project._id,
      },
    );
    keyContent = legacyKey?.keyContent;
  }
  if (!keyContent) {
    throw new Error(
      options.detailedErrors
        ? "App Store Connect API key (.p8) not uploaded — generate one " +
            "at App Store Connect → Users and Access → Integrations → " +
            "App Store Connect API → Team Keys and upload it in Settings."
        : "App Store Connect API key (.p8) not uploaded",
    );
  }
  return { issuerId, keyId, keyContent };
}

async function getProjectForActionArgs(
  ctx: ActionCtx,
  args: { apiKey?: string; projectId?: Id<"projects"> },
): Promise<Doc<"projects">> {
  if (args.projectId) {
    const userId: Id<"users"> | null = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project: Doc<"projects"> | null = await ctx.runQuery(
      internal.projects.internal.getProjectById,
      { projectId: args.projectId },
    );
    if (!project) {
      throw new Error("Project not found");
    }

    const membership = await ctx.runQuery(
      internal.organizations.internal.getMembership,
      { userId, organizationId: project.organizationId },
    );
    if (!membership) {
      throw new Error("Not a member of this organization");
    }

    return project;
  }

  if (args.apiKey !== undefined) {
    return await getProjectByApiKey(ctx, args.apiKey, "admin");
  }

  throw new Error("apiKey or projectId is required");
}

// App Store Connect REST client. Each request carries a fresh ES256 JWT signed
// with the project's `.p8` key (600s TTL, renewed 60s before expiry). Errors
// throw the status plus ASC's JSON:API `errors[].detail`, so callers see the
// reason instead of "fetch failed".

const ASC_BASE = "https://api.appstoreconnect.apple.com";
const ASC_FETCH_TIMEOUT_MS = 30_000;

type AscToken = { value: string; expiresAt: number };

/**
 * Non-OK ASC response. Keeps the status so callers can branch on it, e.g.
 * ignore a 409 when a retried localization push finds the resource already
 * exists.
 */
export class AscApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AscApiError";
  }
}

function isBenignAscRetryConflict(error: unknown): boolean {
  if (!(error instanceof AscApiError) || error.status !== 409) return false;
  const message = error.message.toLowerCase();
  if (
    message.includes("missing a required") ||
    message.includes("invalid format") ||
    message.includes("invalid")
  ) {
    return false;
  }
  return (
    message.includes("already") ||
    message.includes("duplicate") ||
    message.includes("exists")
  );
}

interface AscPriceStartAttributes {
  startDate?: string;
}

/** Omitting startDate is ASC's representation for an immediate price. */
export function ascPriceStartAttributes(
  startDate?: string,
): AscPriceStartAttributes {
  return startDate === undefined ? {} : { startDate };
}

// ASC `links.next` is fully qualified; `call()` prepends ASC_BASE, so strip
// the host before passing it back in. Fail closed on off-origin URLs: a
// prefix check would admit `ASC_BASE + ".evil.com/…"`, leaking the token.
export function relativizeAscPath(absoluteOrRelative: string): string {
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(absoluteOrRelative)) {
    return absoluteOrRelative;
  }
  const parsed = new URL(absoluteOrRelative);
  if (parsed.origin !== ASC_BASE) {
    throw new Error(
      `Refusing to follow ASC pagination off-origin: ${parsed.origin}`,
    );
  }
  return `${parsed.pathname}${parsed.search}`;
}

class AscClient {
  private cached: AscToken | null = null;

  constructor(
    private readonly issuerId: string | undefined,
    private readonly keyId: string,
    private readonly privateKey: string,
    private readonly beforeRequest: () => Promise<void> = async () => undefined,
  ) {}

  private async token(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cached && this.cached.expiresAt - now > 60) {
      return this.cached.value;
    }
    const value = mintAscJwt({
      issuerId: this.issuerId,
      keyId: this.keyId,
      privateKey: this.privateKey,
      ttlSeconds: 600,
    });
    this.cached = { value, expiresAt: now + 600 };
    return value;
  }

  private async call<T>(
    path: string,
    init: RequestInit & { body?: string } = {},
    skipBoundaryCheck = false,
  ): Promise<T> {
    if (!skipBoundaryCheck) await this.beforeRequest();
    // ASC normally answers within 3s, and nothing else would stop one hung
    // request from stalling the whole sync until the 10-minute action limit.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ASC_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${ASC_BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${await this.token()}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          accept: "application/json",
          ...(init.headers as Record<string, string> | undefined),
        },
      });
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    let parsed: unknown = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // leave as text
      }
    }
    if (!response.ok) {
      const errorMessage = extractAscError(parsed);
      // Apple's 401 message is the same for several causes, so hint at the
      // most common: an In-App Purchase key uploaded instead of an ASC API key.
      const message =
        response.status === 401
          ? `ASC ${path} returned 401: ${errorMessage}\n` +
            "HINT: ASC REST endpoints (/v1/apps/.../inAppPurchasesV2, " +
            "subscriptionGroups, …) require the App Store Connect API " +
            "Team Key (or Individual Key) — found under Users and " +
            "Access → Integrations → App Store Connect API. The " +
            "In-App Purchase Key (Users and Access → Integrations → " +
            "In-App Purchase) is a different key and only works for " +
            "the App Store Server API (receipt verification). Both " +
            "are .p8 files but Apple scopes them separately. Re-upload " +
            "the .p8 generated under 'App Store Connect API' and use " +
            "ITS Issuer ID + Key ID in the dashboard."
          : `ASC ${path} returned ${response.status}: ${errorMessage}`;
      throw new AscApiError(response.status, message);
    }
    return parsed as T;
  }

  // Version-based App Review helpers live in ascReview.ts so their binary
  // upload and submission workflow can be tested with a mocked transport.
  // Keep the authenticated JSON transport here as the single JWT boundary.
  request<T>(path: string, init?: RequestInit & { body?: string }): Promise<T> {
    return this.call<T>(path, init);
  }

  // Cleanup must still be able to cancel an IAPKit-owned remote draft after
  // the normal request guard detects operator cancellation or the job safety
  // deadline. Callers expose this transport only to bounded cleanup paths.
  requestForCleanup<T>(
    path: string,
    init?: RequestInit & { body?: string },
  ): Promise<T> {
    return this.call<T>(path, init, true);
  }

  // ASC pages cap at 200 items; without pagination, larger catalogs silently
  // lose products.
  async listInAppPurchases(appId: string): Promise<AscIapListResponse> {
    return this.collectAllPages<AscIapResource["data"]>(
      `/v1/apps/${encodeURIComponent(appId)}/inAppPurchasesV2?limit=200`,
    );
  }

  getInAppPurchase(id: string): Promise<AscIapResource> {
    return this.call<AscIapResource>(
      `/v2/inAppPurchases/${encodeURIComponent(id)}`,
    );
  }

  listInAppPurchaseVersions(
    id: string,
  ): Promise<AscReviewVersionHistoryListResponse> {
    return this.call<AscReviewVersionHistoryListResponse>(
      `/v2/inAppPurchases/${encodeURIComponent(id)}/versions?limit=200`,
    );
  }

  async listSubscriptionGroups(
    appId: string,
  ): Promise<AscSubGroupListResponse> {
    return this.collectAllPages<AscSubGroupListResponse["data"][number]>(
      `/v1/apps/${encodeURIComponent(appId)}/subscriptionGroups?limit=200`,
    );
  }

  async listSubscriptionsInGroup(groupId: string): Promise<AscSubListResponse> {
    return this.collectAllPages<AscSubResource["data"]>(
      `/v1/subscriptionGroups/${encodeURIComponent(groupId)}/subscriptions?limit=200`,
    );
  }

  async listSubscriptionGroupVersions(
    groupId: string,
  ): Promise<AscSubGroupVersionListResponse> {
    return this.collectAllPages<AscSubGroupVersionListResponse["data"][number]>(
      `/v1/subscriptionGroups/${encodeURIComponent(groupId)}/versions?limit=200`,
    );
  }

  listSubscriptionVersions(
    id: string,
  ): Promise<AscReviewVersionHistoryListResponse> {
    return this.call<AscReviewVersionHistoryListResponse>(
      `/v1/subscriptions/${encodeURIComponent(id)}/versions?limit=200`,
    );
  }

  // Follows `links.next`; the 200-page cap (40k items, more than ASC allows per
  // app) only stops a runaway loop.
  private async collectAllPages<T>(
    initialPath: string,
  ): Promise<{ data: T[] }> {
    const merged: T[] = [];
    let path: string | null = initialPath;
    let pages = 0;
    while (path && pages < 200) {
      const page: { data: T[]; links?: { next?: string } } =
        await this.call(path);
      merged.push(...page.data);
      const nextUrl = page.links?.next ?? null;
      path = nextUrl ? relativizeAscPath(nextUrl) : null;
      pages += 1;
    }
    return { data: merged };
  }

  // The USA intro offer, for the dashboard badge (Apple allows one per
  // subscription per territory). Returns the Error so the caller records a
  // failure instead of dropping it.
  async subIntroductoryOffer(
    subId: string,
  ): Promise<AscIntroOfferListResponse | Error> {
    try {
      return await this.call<AscIntroOfferListResponse>(
        `/v1/subscriptions/${encodeURIComponent(subId)}/introductoryOffers?filter[territory]=USA&include=subscriptionPricePoint&limit=10`,
      );
    } catch (error) {
      if (isProductSyncAbortError(error)) throw error;
      return error instanceof Error ? error : new Error(String(error));
    }
  }

  // The product's assigned USA price. Not `pricePoints`, which lists every tier
  // (so `limit=1` gave $0.29): the assigned price is on `iapPriceSchedule`
  // (IAPs) or `prices` (subscriptions). Returns the Error so the caller can
  // report the ASC reason in `failures`.
  async iapCurrentPrice(
    iapId: string,
  ): Promise<AscManualPricesResponse | Error> {
    // The schedule relationship is under /v2/ even though the list is
    // /v1/.../inAppPurchasesV2; /v1/inAppPurchases/{id}/iapPriceSchedule is the
    // legacy resource and 404s. The manualPrices lookup stays on /v1/.
    try {
      const schedule = await this.call<AscIapPriceScheduleResponse>(
        `/v2/inAppPurchases/${encodeURIComponent(iapId)}/relationships/iapPriceSchedule`,
      );
      if (!schedule?.data?.id) {
        return new Error(
          "iapPriceSchedule returned no data — IAP has no price schedule yet",
        );
      }
      const manual = await this.call<AscManualPricesResponse>(
        `/v1/inAppPurchasePriceSchedules/${encodeURIComponent(schedule.data.id)}/manualPrices?filter[territory]=USA&include=inAppPurchasePricePoint`,
      );
      // With Apple's equalized auto-pricing, manualPrices is empty and the USA
      // price is in `automaticPrices` (same shape).
      if (manual.data.length === 0) {
        return await this.call<AscManualPricesResponse>(
          `/v1/inAppPurchasePriceSchedules/${encodeURIComponent(schedule.data.id)}/automaticPrices?filter[territory]=USA&include=inAppPurchasePricePoint`,
        );
      }
      return manual;
    } catch (error) {
      if (isProductSyncAbortError(error)) throw error;
      return error instanceof Error ? error : new Error(String(error));
    }
  }
  async subCurrentPrice(
    subId: string,
  ): Promise<AscSubscriptionPricesResponse | Error> {
    try {
      return await this.call<AscSubscriptionPricesResponse>(
        `/v1/subscriptions/${encodeURIComponent(subId)}/prices?filter[territory]=USA&include=subscriptionPricePoint`,
      );
    } catch (error) {
      if (isProductSyncAbortError(error)) throw error;
      return error instanceof Error ? error : new Error(String(error));
    }
  }

  // USA price-point id matching a USD amount: ASC sets prices by opaque tier
  // id, not by amount. Returns null when no tier matches; ASC errors throw so
  // they are not mistaken for a missing tier.
  async findIapUsaPricePointId(
    iapId: string,
    targetMicros: number,
  ): Promise<string | null> {
    // The USA tier list can exceed one 200-item page ($24.99, $299.99, ...).
    const list = await this.collectAllPages<
      AscPricePointListResponse["data"][number]
    >(
      `/v2/inAppPurchases/${encodeURIComponent(iapId)}/pricePoints?filter[territory]=USA&limit=200`,
    );
    return pickPricePointIdMatching(list, targetMicros);
  }
  async findSubUsaPricePointId(
    subId: string,
    targetMicros: number,
  ): Promise<string | null> {
    const list = await this.collectAllPages<
      AscPricePointListResponse["data"][number]
    >(
      `/v1/subscriptions/${encodeURIComponent(subId)}/pricePoints?filter[territory]=USA&limit=200`,
    );
    return pickPricePointIdMatching(list, targetMicros);
  }

  // One POST creates the schedule and its USA price, passed as an inline
  // `included` row.
  setIapPriceSchedule(args: {
    iapId: string;
    pricePointId: string;
    startDate?: string; // YYYY-MM-DD; omit for "effective immediately"
  }) {
    const priceLid = "${newPrice}";
    return this.call<{ data: { id: string } }>(
      `/v1/inAppPurchasePriceSchedules`,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "inAppPurchasePriceSchedules",
            relationships: {
              inAppPurchase: {
                data: { type: "inAppPurchases", id: args.iapId },
              },
              baseTerritory: {
                data: { type: "territories", id: "USA" },
              },
              manualPrices: {
                data: [{ type: "inAppPurchasePrices", id: priceLid }],
              },
            },
          },
          included: [
            {
              type: "inAppPurchasePrices",
              id: priceLid,
              attributes: ascPriceStartAttributes(args.startDate),
              relationships: {
                inAppPurchasePricePoint: {
                  data: {
                    type: "inAppPurchasePricePoints",
                    id: args.pricePointId,
                  },
                },
                inAppPurchaseV2: {
                  data: { type: "inAppPurchases", id: args.iapId },
                },
              },
            },
          ],
        }),
      },
    );
  }
  setSubPriceSchedule(args: {
    subId: string;
    pricePointId: string;
    startDate?: string;
  }) {
    return this.createSubPriceChange(args);
  }

  createSubPriceChange(args: {
    subId: string;
    pricePointId: string;
    startDate?: string;
  }) {
    const attributes =
      args.startDate === undefined ? {} : { startDate: args.startDate };
    return this.call<{ data: { id: string } }>(`/v1/subscriptionPrices`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "subscriptionPrices",
          attributes,
          relationships: {
            subscription: {
              data: { type: "subscriptions", id: args.subId },
            },
            subscriptionPricePoint: {
              data: {
                type: "subscriptionPricePoints",
                id: args.pricePointId,
              },
            },
            territory: {
              data: { type: "territories", id: "USA" },
            },
          },
        },
      }),
    });
  }

  // Lets the operator type a group name instead of pasting ASC's opaque id.
  async findOrCreateSubscriptionGroup(args: {
    appId: string;
    referenceName: string;
  }): Promise<string> {
    const groups = await this.listSubscriptionGroups(args.appId);
    const existing = groups.data.find(
      (g) => g.attributes.referenceName === args.referenceName,
    );
    if (existing) return existing.id;
    const created = await this.call<{ data: { id: string } }>(
      `/v1/subscriptionGroups`,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "subscriptionGroups",
            attributes: { referenceName: args.referenceName },
            relationships: {
              app: { data: { type: "apps", id: args.appId } },
            },
          },
        }),
      },
    );
    return created.data.id;
  }

  createInAppPurchase(args: {
    appId: string;
    productId: string;
    name: string;
    type: "CONSUMABLE" | "NON_CONSUMABLE" | "NON_RENEWING_SUBSCRIPTION";
    reviewNote?: string;
  }) {
    return this.call<AscIapResource>(`/v2/inAppPurchases`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "inAppPurchases",
          attributes: {
            name: args.name,
            productId: args.productId,
            inAppPurchaseType: args.type,
            reviewNote: args.reviewNote,
          },
          relationships: {
            app: { data: { type: "apps", id: args.appId } },
          },
        },
      }),
    });
  }

  patchInAppPurchase(
    id: string,
    attributes: { name?: string; reviewNote?: string },
  ) {
    return this.call<AscIapResource>(
      `/v2/inAppPurchases/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: { type: "inAppPurchases", id, attributes },
        }),
      },
    );
  }

  async deleteInAppPurchase(id: string): Promise<void> {
    await this.call<unknown>(`/v2/inAppPurchases/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  createSubscription(args: {
    groupId: string;
    productId: string;
    name: string;
    subscriptionPeriod:
      | "ONE_WEEK"
      | "ONE_MONTH"
      | "TWO_MONTHS"
      | "THREE_MONTHS"
      | "SIX_MONTHS"
      | "ONE_YEAR";
    reviewNote?: string;
  }) {
    return this.call<AscSubResource>(`/v1/subscriptions`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "subscriptions",
          attributes: {
            name: args.name,
            productId: args.productId,
            subscriptionPeriod: args.subscriptionPeriod,
            reviewNote: args.reviewNote,
          },
          relationships: {
            group: {
              data: { type: "subscriptionGroups", id: args.groupId },
            },
          },
        },
      }),
    });
  }

  patchSubscription(
    id: string,
    attributes: { name?: string; reviewNote?: string },
  ) {
    return this.call<AscSubResource>(
      `/v1/subscriptions/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: { type: "subscriptions", id, attributes },
        }),
      },
    );
  }

  async deleteSubscription(id: string): Promise<void> {
    await this.call<unknown>(`/v1/subscriptions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}

type AscIapResource = {
  data: {
    id: string;
    type: "inAppPurchases";
    attributes: {
      productId?: string;
      name?: string;
      inAppPurchaseType?: string;
      state?: string;
      reviewNote?: string;
    };
  };
};

type AscIapListResponse = {
  data: AscIapResource["data"][];
};

type AscSubResource = {
  data: {
    id: string;
    type: "subscriptions";
    attributes: {
      productId?: string;
      name?: string;
      subscriptionPeriod?: string;
      state?: string;
      reviewNote?: string;
    };
  };
};

type AscSubListResponse = {
  data: AscSubResource["data"][];
};

type AscSubGroupListResponse = {
  data: Array<{
    id: string;
    type: "subscriptionGroups";
    attributes: { referenceName?: string };
  }>;
};

type AscSubGroupVersionListResponse = {
  data: Array<{
    id: string;
    type: "subscriptionGroupVersions";
    attributes?: { state?: string; version?: string };
  }>;
};

type AscReviewVersionHistoryListResponse = {
  data: Array<{
    id: string;
    attributes?: { state?: string; version?: string };
  }>;
};

interface AscReviewEligibilityClient {
  listInAppPurchases(appId: string): Promise<AscIapListResponse>;
  listInAppPurchaseVersions(
    id: string,
  ): Promise<AscReviewVersionHistoryListResponse>;
  listSubscriptionGroups(appId: string): Promise<AscSubGroupListResponse>;
  listSubscriptionsInGroup(groupId: string): Promise<AscSubListResponse>;
  listSubscriptionGroupVersions(
    groupId: string,
  ): Promise<AscSubGroupVersionListResponse>;
  listSubscriptionVersions(
    id: string,
  ): Promise<AscReviewVersionHistoryListResponse>;
}

async function someWithConcurrency<T>(
  values: readonly T[],
  concurrency: number,
  predicate: (value: T) => Promise<boolean>,
): Promise<boolean> {
  if (values.length === 0) return false;
  let nextIndex = 0;
  let found = false;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (!found) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= values.length) return;
        if (await predicate(values[index])) {
          found = true;
          return;
        }
      }
    },
  );
  await Promise.all(workers);
  return found;
}

interface AscReviewEligibilityLoader {
  resolveSubscriptionGroupId(referenceName: string): Promise<string | null>;
  getActions(item: AscReviewVersionItem): Promise<AscManualReviewAction[]>;
}

// Loads version history lazily, only for the current candidate batch: an eager
// scan of every version could exhaust the worker deadline on large catalogs and
// repeat forever. The promise caches are shared by concurrent rows and later
// dry-run batches, and stop at the first approved predecessor.
export function createAscReviewEligibilityLoader(args: {
  client: AscReviewEligibilityClient;
  appId: string;
  checkCancelled: () => Promise<void>;
}): AscReviewEligibilityLoader {
  const { client, appId, checkCancelled } = args;
  let iapsPromise: Promise<AscIapListResponse> | null = null;
  let groupsPromise: Promise<AscSubGroupListResponse> | null = null;
  const subscriptionLists = new Map<string, Promise<AscSubListResponse>>();
  const subscriptionApprovals = new Map<string, Promise<boolean>>();
  const groupApprovals = new Map<string, Promise<boolean>>();
  const productTypeApprovals = new Map<
    AscReviewVersionItem["productType"],
    Promise<boolean>
  >();

  const listIaps = () => {
    iapsPromise ??= client.listInAppPurchases(appId);
    return iapsPromise;
  };
  const listGroups = () => {
    groupsPromise ??= client.listSubscriptionGroups(appId);
    return groupsPromise;
  };
  const listSubscriptions = (groupId: string) => {
    let pending = subscriptionLists.get(groupId);
    if (!pending) {
      pending = client.listSubscriptionsInGroup(groupId);
      subscriptionLists.set(groupId, pending);
    }
    return pending;
  };
  const hasApprovedSubscription = (subscription: AscSubResource["data"]) => {
    let pending = subscriptionApprovals.get(subscription.id);
    if (!pending) {
      pending = (async () => {
        await checkCancelled();
        if (isAscApprovedReviewHistoryState(subscription.attributes.state)) {
          return true;
        }
        const versions = await client.listSubscriptionVersions(subscription.id);
        return versions.data.some((version) =>
          isAscApprovedReviewHistoryState(version.attributes?.state),
        );
      })();
      subscriptionApprovals.set(subscription.id, pending);
    }
    return pending;
  };
  const groupHasApprovedSubscription = async (groupId: string) => {
    await checkCancelled();
    const subscriptions = await listSubscriptions(groupId);
    return someWithConcurrency(subscriptions.data, 3, hasApprovedSubscription);
  };
  const hasApprovedGroup = (groupId: string) => {
    let pending = groupApprovals.get(groupId);
    if (!pending) {
      pending = (async () => {
        await checkCancelled();
        const groups = await listGroups();
        if (!groups.data.some((group) => group.id === groupId)) return false;
        const [hasApprovedSubscription, versions] = await Promise.all([
          groupHasApprovedSubscription(groupId),
          client.listSubscriptionGroupVersions(groupId),
        ]);
        return (
          hasApprovedSubscription ||
          versions.data.some((version) =>
            isAscApprovedReviewHistoryState(version.attributes?.state),
          )
        );
      })();
      groupApprovals.set(groupId, pending);
    }
    return pending;
  };
  const hasApprovedProductType = (
    productType: AscReviewVersionItem["productType"],
  ) => {
    let pending = productTypeApprovals.get(productType);
    if (!pending) {
      pending = (async () => {
        await checkCancelled();
        if (productType === "Subscription") {
          const groups = await listGroups();
          return someWithConcurrency(groups.data, 2, (group) =>
            groupHasApprovedSubscription(group.id),
          );
        }
        const iaps = await listIaps();
        const candidates = iaps.data.filter((iap) => {
          const mapped = mapAscReviewProductType(
            iap.attributes.inAppPurchaseType,
            mapAscIapType(iap.attributes.inAppPurchaseType),
          );
          return mapped === productType;
        });
        if (
          candidates.some((iap) =>
            isAscApprovedReviewHistoryState(iap.attributes.state),
          )
        ) {
          return true;
        }
        return someWithConcurrency(candidates, 3, async (iap) => {
          await checkCancelled();
          const versions = await client.listInAppPurchaseVersions(iap.id);
          return versions.data.some((version) =>
            isAscApprovedReviewHistoryState(version.attributes?.state),
          );
        });
      })();
      productTypeApprovals.set(productType, pending);
    }
    return pending;
  };

  return {
    async resolveSubscriptionGroupId(referenceName) {
      await checkCancelled();
      const groups = await listGroups();
      return (
        groups.data.find(
          (group) => group.attributes.referenceName === referenceName,
        )?.id ?? null
      );
    },
    async getActions(item) {
      const [typeApproved, groupApproved] = await Promise.all([
        hasApprovedProductType(item.productType),
        item.productType === "Subscription" && item.subscriptionGroupId
          ? hasApprovedGroup(item.subscriptionGroupId)
          : Promise.resolve(false),
      ]);
      const snapshot: AscReviewEligibilitySnapshot = {
        approvedProductTypes: typeApproved
          ? new Set([item.productType])
          : new Set(),
        approvedSubscriptionGroupIds:
          groupApproved && item.subscriptionGroupId
            ? new Set([item.subscriptionGroupId])
            : new Set(),
      };
      return getAscReviewEligibilityActions({ item, snapshot });
    },
  };
}

// Every USA price point Apple publishes for a product (the tier ladder), used
// to turn a USD amount into the price-point id a price schedule needs.
// `AscManualPricesResponse` is the operator's pick.
type AscPricePointListResponse = {
  data: Array<{
    id: string;
    type: "inAppPurchasePricePoints" | "subscriptionPricePoints";
    attributes?: { customerPrice?: string };
  }>;
};

// Price point within 1 cent of the USD amount, or null so the caller asks the
// operator for a tier ASC publishes.
export function pickPricePointIdMatching(
  list: AscPricePointListResponse | null,
  targetMicros: number,
): string | null {
  if (!list) return null;
  if (!Number.isSafeInteger(targetMicros) || targetMicros < 0) return null;
  const targetCents = Math.round(targetMicros / 10_000);
  for (const point of list.data) {
    const pointMicros = ascCustomerPriceToMicros(
      point.attributes?.customerPrice,
    );
    if (pointMicros === undefined) continue;
    const pointCents = Math.round(pointMicros / 10_000);
    if (Math.abs(pointCents - targetCents) <= 1) return point.id;
  }
  return null;
}

// Only the id is read, to fetch `manualPrices`.
type AscIapPriceScheduleResponse = {
  data?: { id: string; type: "inAppPurchasePriceSchedules" } | null;
};

// Shared by `manualPrices` and `subscriptionPrices`: each row references a
// price point whose `customerPrice` is in `included`.
type AscManualPricesResponse = {
  data: Array<{
    id: string;
    type: "inAppPurchasePrices";
    attributes?: { startDate?: string | null; endDate?: string | null };
    relationships?: {
      inAppPurchasePricePoint?: { data?: { id: string } | null };
    };
  }>;
  included?: Array<{
    id: string;
    type: "inAppPurchasePricePoints";
    attributes?: { customerPrice?: string };
  }>;
};

type AscSubscriptionPricesResponse = {
  data: Array<{
    id: string;
    type: "subscriptionPrices";
    attributes?: { startDate?: string | null; endDate?: string | null };
    relationships?: {
      subscriptionPricePoint?: { data?: { id: string } | null };
    };
  }>;
  included?: Array<{
    id: string;
    type: "subscriptionPricePoints";
    attributes?: { customerPrice?: string };
  }>;
};

// Apple's `offerMode`: FREE_TRIAL (no price point), PAY_UP_FRONT (one price for
// N periods), PAY_AS_YOU_GO (a price each period). `numberOfPeriods` differs by
// mode and passes through for the dashboard to label.
type AscIntroOfferListResponse = {
  data: Array<{
    id: string;
    type: "subscriptionIntroductoryOffers";
    attributes?: {
      offerMode?: "FREE_TRIAL" | "PAY_UP_FRONT" | "PAY_AS_YOU_GO";
      duration?: string; // ISO-8601-ish: "ONE_WEEK", "THREE_DAYS", etc.
      numberOfPeriods?: number;
      startDate?: string | null;
      endDate?: string | null;
    };
    relationships?: {
      subscriptionPricePoint?: { data?: { id: string } | null };
    };
  }>;
  included?: Array<{
    id: string;
    type: "subscriptionPricePoints";
    attributes?: { customerPrice?: string };
  }>;
};

// The price row in effect today (a missing bound is open). A scheduled change
// adds a second row, so `data[0]` is not enough.
export function pickActivePriceRow<
  T extends {
    attributes?: { startDate?: string | null; endDate?: string | null };
  },
>(rows: T[]): T | null {
  if (!rows.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const active = rows.find((row) => {
    const start = row.attributes?.startDate ?? null;
    const end = row.attributes?.endDate ?? null;
    if (start && start > today) return false;
    if (end && end < today) return false;
    return true;
  });
  return active ?? rows[0];
}

// Common shape of IAP and subscription price responses; the relationship key
// names differ, so callers pass them in.
type AscPriceCollectionResponse = {
  data: Array<{
    id: string;
    type: string;
    attributes?: { startDate?: string | null; endDate?: string | null };
    relationships?: Record<
      string,
      { data?: { id: string } | null } | undefined
    >;
  }>;
  included?: Array<{
    id: string;
    type: string;
    attributes?: { customerPrice?: string };
  }>;
};

// The active row's `customerPrice`, or empty fields when there is none, ready
// for upsertFromStore.
function parseAssignedPrice(
  resp: AscPriceCollectionResponse | null,
  relationshipKey: "inAppPurchasePricePoint" | "subscriptionPricePoint",
): { priceAmountMicros?: number; currency?: string } {
  if (!resp) return {};
  const row = pickActivePriceRow(resp.data);
  if (!row) return {};
  const pointId = row.relationships?.[relationshipKey]?.data?.id;
  if (!pointId) return {};
  const point = resp.included?.find((entry) => entry.id === pointId);
  const priceAmountMicros = ascCustomerPriceToMicros(
    point?.attributes?.customerPrice,
  );
  if (priceAmountMicros === undefined) return {};
  return {
    priceAmountMicros,
    currency: "USD",
  };
}

export function ascCustomerPriceToMicros(
  raw: string | undefined,
): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  const micros = Math.round(n * 1_000_000);
  return Number.isSafeInteger(micros) ? micros : undefined;
}

function extractAscError(parsed: unknown): string {
  if (
    parsed &&
    typeof parsed === "object" &&
    "errors" in parsed &&
    Array.isArray((parsed as { errors: unknown[] }).errors)
  ) {
    const errors = (
      parsed as { errors: Array<{ detail?: string; title?: string }> }
    ).errors;
    return (
      errors.map((e) => e.detail ?? e.title ?? "").join("; ") || "(no detail)"
    );
  }
  return typeof parsed === "string" ? parsed : "(non-JSON error)";
}

// ---------------------------------------------------------------------------
// Sync worker: pulls the ASC catalog into kit's `products` rows and pushes
// Draft / Ready rows upstream.
// ---------------------------------------------------------------------------

// Runs one ASC sync job. Only `enqueueProductSync` (products/jobs.ts) schedules
// it, so the long fetch never holds a browser connection open. Convex actions
// cap at ~10 minutes: the job deadline is 9, remote work stops 45s before it
// for cleanup, and the reaper covers crashes.
export const runProductSyncIOS = internalAction({
  args: { jobId: v.id("productSyncJobs") },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(internal.products.jobs.getJobForWorker, {
      jobId: args.jobId,
    });
    if (!job) return;
    if (job.status !== "queued") return;
    const workerDeadline = await ctx.runMutation(
      internal.products.jobs.markJobRunning,
      {
        jobId: args.jobId,
      },
    );
    if (workerDeadline === null) return;
    const checkCancelled = async () => {
      if (isProductSyncDeadlineReached(Date.now(), workerDeadline)) {
        throw new ProductSyncDeadlineError();
      }
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
      const result = await performIosSync(ctx, {
        projectId: job.projectId,
        direction: job.direction,
        dryRun: job.dryRun,
        checkCancelled,
        reportPhase,
      });
      // Bound before crossing the action→mutation boundary; the mutation also
      // applies the cap defensively before persisting the job document.
      const boundedManualActions = truncateManualActions(
        result.manualActions ?? [],
      );
      const boundedPlannedWrites = truncatePlannedWrites(
        result.plannedWrites ?? [],
      );
      await ctx.runMutation(internal.products.jobs.markJobSucceeded, {
        jobId: args.jobId,
        pulled: result.pulled,
        pushed: result.pushed,
        deleted: result.deleted,
        failures: result.failures,
        plannedWrites:
          boundedPlannedWrites.items.length > 0
            ? boundedPlannedWrites.items
            : undefined,
        plannedWritesTruncated: boundedPlannedWrites.truncated || undefined,
        manualActions:
          boundedManualActions.items.length > 0
            ? boundedManualActions.items
            : undefined,
        manualActionsTruncated: boundedManualActions.truncated || undefined,
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

interface SyncProgressUpdate {
  current?: number;
  total?: number;
  failuresCount?: number;
}
type SyncProgressReporter = (
  phase: string,
  extra?: SyncProgressUpdate,
) => Promise<void>;

interface IosSyncOptions {
  projectId: import("../_generated/dataModel").Id<"projects">;
  direction: "pull" | "push" | "both";
  dryRun: boolean;
  checkCancelled: () => Promise<void>;
  reportPhase: SyncProgressReporter;
}

interface SyncResult {
  pulled: number;
  pushed: number;
  deleted?: number;
  failures: Array<{ productId: string; reason: string }>;
  plannedWrites?: Array<{ productId: string; step: string; detail?: string }>;
  manualActions?: AscManualReviewAction[];
}

export function getAscReviewFinalizeDisposition(args: {
  alreadySubmitted: boolean;
  attachedToSubmission: boolean;
  screenshotConfigured: boolean;
}): "already-submitted" | "attached" | "ready" | "submit" {
  if (args.alreadySubmitted) return "already-submitted";
  if (args.attachedToSubmission) return "attached";
  if (!args.screenshotConfigured) return "ready";
  return "submit";
}

// Only a confirmed submission is terminal. Manual outcomes stay Draft until the
// worker persists the operator instruction, so a crash before that surfaces it
// again next run.
export function shouldMarkAscReviewSubmissionOutcomePushed(
  outcome: AscReviewSubmissionOutcome,
): boolean {
  return outcome.status === "submitted";
}

async function performIosSync(
  ctx: ActionCtx,
  options: IosSyncOptions,
): Promise<SyncResult> {
  const project = await ctx.runQuery(
    internal.projects.internal.getProjectById,
    { projectId: options.projectId },
  );
  if (!project) {
    throw new Error("Project not found for sync job");
  }
  if (!project.iosBundleId) {
    throw new Error("Project iosBundleId is not configured");
  }
  if (!project.iosAppAppleId) {
    throw new Error("Project iosAppAppleId is required for ASC push-sync");
  }
  const args = {
    direction: options.direction,
    dryRun: options.dryRun,
  };
  const { checkCancelled, reportPhase } = options;
  const { issuerId, keyId, keyContent } = await resolveAscCredentials(
    ctx,
    project,
    { detailedErrors: true },
  );
  const client = new AscClient(issuerId, keyId, keyContent, checkCancelled);
  const ascJsonRequest: AscJsonRequest = <T>(
    path: string,
    init?: RequestInit & { body?: string },
  ) => client.request<T>(path, init);

  const direction = args.direction ?? "both";
  const failures: Array<{ productId: string; reason: string }> = [];
  const manualActions: AscManualReviewAction[] = [];
  let pulled = 0;
  let pushed = 0;
  const dryRun = args.dryRun ?? false;
  const plannedWrites: Array<{
    productId: string;
    step: string;
    detail?: string;
  }> = [];

  const appIdStr = String(project.iosAppAppleId);
  let deleted = 0;
  const ascReviewProductTypeByStoreRef = new Map<
    string,
    AscReviewVersionItem["productType"]
  >();
  // Capture the screenshot identity before a direction="both" pull. Product
  // rows persist the last handled file id, so pull-side timestamp changes do
  // not affect deterministic Ready-row resumption.
  const prePullScreenshotMetadata =
    direction === "push" || direction === "both"
      ? await ctx.runQuery(
          internal.files.internal.getAppleReviewScreenshotByProjectInternal,
          { projectId: project._id },
        )
      : null;
  // ── PULL: ASC → kit catalog ────────────────────────────────────
  if (direction === "pull" || direction === "both") {
    await checkCancelled();
    await reportPhase("pull-iaps");
    const iaps = await client.listInAppPurchases(appIdStr).catch((error) => {
      if (isProductSyncAbortError(error)) throw error;
      failures.push({
        productId: "(asc list iaps)",
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    if (iaps) {
      // ASC throttles at ~50 req/min; 6 in flight stays clear of 429s.
      const iapResults = await mapWithConcurrency(
        iaps.data,
        6,
        async (item) => {
          const productId = item.attributes.productId;
          if (!productId) return null;
          const type = mapAscIapType(item.attributes.inAppPurchaseType);
          const [pricePoint, listings] = await Promise.all([
            client.iapCurrentPrice(item.id),
            readAscReviewListings({
              request: ascJsonRequest,
              kind: "iap",
              parentId: item.id,
              checkCancelled,
            }).catch((error) => {
              if (isProductSyncAbortError(error)) throw error;
              failures.push({
                productId: `${productId} (localization lookup)`,
                reason: error instanceof Error ? error.message : String(error),
              });
              return [];
            }),
          ]);
          const reviewProductType = mapAscReviewProductType(
            item.attributes.inAppPurchaseType,
            type,
          );
          return {
            item,
            productId,
            type,
            pricePoint,
            listings,
            reviewProductType,
          };
        },
      );
      for (const result of iapResults) {
        if (!result) continue;
        const {
          item,
          productId,
          type,
          pricePoint,
          listings,
          reviewProductType,
        } = result;
        ascReviewProductTypeByStoreRef.set(item.id, reviewProductType);
        if (pricePoint instanceof Error) {
          failures.push({
            productId: `${productId} (price lookup)`,
            reason: pricePoint.message,
          });
        }
        const { priceAmountMicros, currency } = parseAssignedPrice(
          pricePoint instanceof Error ? null : pricePoint,
          "inAppPurchasePricePoint",
        );
        // Serial: parallel mutations on one row would race on the (projectId,
        // platform, productId) lookup.
        if (!dryRun) {
          await ctx.runMutation(internal.products.sync.upsertFromStore, {
            projectId: project._id,
            productId,
            platform: "IOS",
            type,
            // The parent name is an internal reference. Customer-facing
            // metadata lives on the current review-version localizations.
            ...splitStoreListings(listings, item.attributes.name ?? productId),
            priceAmountMicros,
            currency,
            storeRef: item.id,
            state: mapAscState(item.attributes.state),
          });
        }
        pulled += 1;
      }
    }

    await checkCancelled();
    await reportPhase("pull-subscriptions", {
      current: pulled,
      failuresCount: failures.length,
    });
    const groups = await client
      .listSubscriptionGroups(appIdStr)
      .catch((error) => {
        if (isProductSyncAbortError(error)) throw error;
        failures.push({
          productId: "(asc list groups)",
          reason: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
    if (groups) {
      for (const group of groups.data) {
        const subs = await client
          .listSubscriptionsInGroup(group.id)
          .catch((error) => {
            if (isProductSyncAbortError(error)) throw error;
            failures.push({
              productId: `(asc list subs in group ${group.id})`,
              reason: error instanceof Error ? error.message : String(error),
            });
            return null;
          });
        if (!subs) continue;
        // As above; each sub's price and intro-offer lookups run in parallel.
        const subResults = await mapWithConcurrency(
          subs.data,
          6,
          async (sub) => {
            const productId = sub.attributes.productId;
            if (!productId) return null;
            const [pricePoint, introOffers, listings] = await Promise.all([
              client.subCurrentPrice(sub.id),
              client.subIntroductoryOffer(sub.id),
              readAscReviewListings({
                request: ascJsonRequest,
                kind: "subscription",
                parentId: sub.id,
                checkCancelled,
              }).catch((error) => {
                if (isProductSyncAbortError(error)) throw error;
                failures.push({
                  productId: `${productId} (localization lookup)`,
                  reason:
                    error instanceof Error ? error.message : String(error),
                });
                return [];
              }),
            ]);
            return { sub, productId, pricePoint, introOffers, listings };
          },
        );
        for (const result of subResults) {
          if (!result) continue;
          const { sub, productId, pricePoint, introOffers, listings } = result;
          if (pricePoint instanceof Error) {
            failures.push({
              productId: `${productId} (price lookup)`,
              reason: pricePoint.message,
            });
          }
          const { priceAmountMicros, currency } = parseAssignedPrice(
            pricePoint instanceof Error ? null : pricePoint,
            "subscriptionPricePoint",
          );
          if (introOffers instanceof Error) {
            failures.push({
              productId: `${productId} (offers lookup)`,
              reason: introOffers.message,
            });
          }
          const offers = parseIntroOffers(
            introOffers instanceof Error ? null : introOffers,
          );
          if (!dryRun) {
            await ctx.runMutation(internal.products.sync.upsertFromStore, {
              projectId: project._id,
              productId,
              platform: "IOS",
              type: "Subscription",
              ...splitStoreListings(listings, sub.attributes.name ?? productId),
              priceAmountMicros,
              currency,
              storeRef: sub.id,
              state: mapAscState(sub.attributes.state),
              billingPeriod: coerceBillingPeriod(
                mapAscOfferDurationToIso(
                  sub.attributes.subscriptionPeriod ?? undefined,
                ),
              ),
              subscriptionGroupId: group.id,
              subscriptionGroupName: group.attributes.referenceName,
              offers: offers.length ? offers : undefined,
            });
          }
          pulled += 1;
        }
      }
    }
  }

  // ── PUSH: kit → ASC for Draft rows ─────────────────────────────
  // Each draft runs create → review version → localize → price → screenshot →
  // review submission, since Apple needs an en-US localization and a USA price
  // before a product leaves Draft. Without a project screenshot the row stops
  // at Ready to Submit instead of failing.
  if (direction === "push" || direction === "both") {
    await checkCancelled();
    await reportPhase("push-removals", {
      current: pulled,
      failuresCount: failures.length,
    });
    const removals = await ctx.runQuery(
      internal.products.sync.listRemovedIosProducts,
      { projectId: project._id },
    );
    for (const row of removals) {
      await checkCancelled();
      const deleteStep =
        row.storeRef === undefined
          ? "delete local product row"
          : row.type === "Subscription"
            ? "delete subscription"
            : "delete in-app purchase";
      if (dryRun) {
        plannedWrites.push({
          productId: row.productId,
          step: deleteStep,
          detail: row.storeRef
            ? `storeRef=${row.storeRef}; Apple product IDs cannot be reused after deletion`
            : "kit-only row has no upstream storeRef",
        });
        continue;
      }
      try {
        if (row.storeRef) {
          if (row.type === "Subscription") {
            await client.deleteSubscription(row.storeRef);
          } else {
            await client.deleteInAppPurchase(row.storeRef);
          }
        }
        const didDelete = await ctx.runMutation(
          internal.products.sync.deleteRemovedProductRow,
          {
            projectId: project._id,
            productId: row.productId,
            platform: "IOS",
          },
        );
        if (didDelete) deleted += 1;
      } catch (error) {
        if (isProductSyncAbortError(error)) throw error;
        if (error instanceof AscApiError && error.status === 404) {
          const didDelete = await ctx.runMutation(
            internal.products.sync.deleteRemovedProductRow,
            {
              projectId: project._id,
              productId: row.productId,
              platform: "IOS",
            },
          );
          if (didDelete) deleted += 1;
          continue;
        }
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
    const reviewRequest = ascJsonRequest;
    const reviewCleanupRequest: AscJsonRequest = <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => client.requestForCleanup<T>(path, init);
    const screenshotMetadata = prePullScreenshotMetadata;
    const drafts = await ctx.runQuery(
      internal.products.sync.listDraftIosProducts,
      {
        projectId: project._id,
        includeReadyForReview: screenshotMetadata !== null,
        reviewScreenshotFileId: screenshotMetadata?.fileId,
      },
    );
    const reviewEligibility = screenshotMetadata
      ? createAscReviewEligibilityLoader({
          client,
          appId: appIdStr,
          checkCancelled,
        })
      : null;
    let reviewScreenshot: AscReviewScreenshot | null = null;
    let reviewScreenshotError: Error | null = null;
    if (screenshotMetadata) {
      try {
        await checkCancelled();
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          ASC_FETCH_TIMEOUT_MS,
        );
        let response: Response;
        try {
          response = await fetch(screenshotMetadata.storageUrl, {
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
        if (!response.ok) {
          throw new Error(
            `Stored App Review screenshot returned HTTP ${response.status}`,
          );
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength !== screenshotMetadata.fileSize) {
          throw new Error(
            "Stored App Review screenshot size no longer matches its file record",
          );
        }
        validateAppleReviewScreenshotContent(
          bytes,
          screenshotMetadata.fileType,
        );
        if (
          screenshotMetadata.fileType !== "image/png" &&
          screenshotMetadata.fileType !== "image/jpeg"
        ) {
          throw new Error(
            "Stored App Review screenshot must be image/png or image/jpeg",
          );
        }
        reviewScreenshot = {
          fileName: screenshotMetadata.fileName,
          fileType: screenshotMetadata.fileType,
          bytes,
        };
      } catch (error) {
        if (isProductSyncAbortError(error)) throw error;
        reviewScreenshotError =
          error instanceof Error ? error : new Error(String(error));
      }
    }
    // In-flight find-or-create per group name, so drafts in one group share one
    // ASC call and never race two creates (one would 409).
    const groupIdCache = new Map<string, Promise<string>>();
    // Dry runs list groups once, lazily on the first subscription draft.
    let dryRunGroupsCache: Awaited<
      ReturnType<typeof client.listSubscriptionGroups>
    > | null = null;
    const ensureDryRunGroups = async () => {
      if (!dryRunGroupsCache) {
        dryRunGroupsCache = await client.listSubscriptionGroups(appIdStr);
      }
      return dryRunGroupsCache;
    };
    // Drafts push 4 at a time, under ASC's write limit (~10/s before 429s; a
    // 429 lands in `failures`). Steps within one draft stay sequential: a
    // localize that lands before its create propagates returns 409. Separate
    // drafts touch independent resources.
    const PUSH_CONCURRENCY = 4;
    const processOneDraft = async (
      row: (typeof drafts)[number],
    ): Promise<AscReviewVersionItem | null> => {
      await checkCancelled();
      // Row-local, since the shared `failures` array also grows with other
      // concurrent drafts. A partial setup stays Draft with its storeRef, so
      // the next sync resumes instead of re-creating.
      let rowHadFailure = false;
      const recordFailure = (failure: {
        productId: string;
        reason: string;
      }) => {
        rowHadFailure = true;
        failures.push(failure);
      };
      const loadEligibilityActions = async (
        item: AscReviewVersionItem,
      ): Promise<AscManualReviewAction[] | null> => {
        if (!reviewEligibility) {
          recordFailure({
            productId: `${row.productId} (review eligibility)`,
            reason: "ASC review eligibility could not be determined",
          });
          return null;
        }
        try {
          return await reviewEligibility.getActions(item);
        } catch (error) {
          if (isProductSyncAbortError(error)) throw error;
          recordFailure({
            productId: `${row.productId} (review eligibility)`,
            reason: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      };
      const resolveReviewVersion = async (
        kind: "iap" | "subscription",
        storeRef: string,
      ): Promise<{
        versionId: string;
        alreadySubmitted: boolean;
        attachedToSubmission: boolean;
      } | null> => {
        if (!dryRun) {
          return await ensureAscReviewVersion({
            request: reviewRequest,
            kind,
            parentId: storeRef,
            allowCreate: true,
            reuseApproved: row.state === "Ready",
            checkCancelled,
          });
        }
        if (!row.storeRef) {
          plannedWrites.push({
            productId: row.productId,
            step: `create ${kind === "iap" ? "in-app purchase" : "subscription"} review version`,
            detail: "version-based App Store Connect 4.4.1 workflow",
          });
          return {
            versionId: "(would-create)",
            alreadySubmitted: false,
            attachedToSubmission: false,
          };
        }
        const current = await inspectAscReviewVersion({
          request: reviewRequest,
          kind,
          parentId: storeRef,
          checkCancelled,
        });
        const plan = planAscReviewVersion({
          localState: row.state,
          current,
        });
        plannedWrites.push({
          productId: row.productId,
          step:
            plan.action === "create"
              ? `create ${kind === "iap" ? "in-app purchase" : "subscription"} review version`
              : "reuse current ASC review version",
          detail:
            plan.action === "create"
              ? "The latest historical version is complete; a new editable version would be created."
              : `version=${plan.reviewVersion.versionId}`,
        });
        return plan.reviewVersion;
      };
      const syncReviewLocalization = async (
        kind: "iap" | "subscription",
        reviewVersion: {
          versionId: string;
          alreadySubmitted: boolean;
          attachedToSubmission: boolean;
        },
      ): Promise<void> => {
        await syncAscReviewLocalization({
          reviewVersion,
          listings: listingRowsForProduct(row),
          productId: row.productId,
          // Compare EVERY locale, not just the base pair: a Draft whose only
          // change is a new or edited translation would otherwise look
          // identical to the locked version and get silently marked pushed.
          findMismatchedLocale: () =>
            ascReviewLocalizationMismatch({
              request: reviewRequest,
              kind,
              versionId: reviewVersion.versionId,
              listings: listingRowsForProduct(row),
              checkCancelled,
            }),
          upsert: (listing) =>
            upsertAscReviewLocalization({
              request: reviewRequest,
              kind,
              versionId: reviewVersion.versionId,
              name: listing.title,
              description: listing.description ?? listing.title,
              locale: listing.locale,
              checkCancelled,
            }),
          recordFailure,
        });
      };
      const finalizeReview = async (
        kind: "iap" | "subscription",
        storeRef: string,
        productType: AscReviewVersionItem["productType"],
        reviewVersion: {
          versionId: string;
          alreadySubmitted: boolean;
          attachedToSubmission: boolean;
        } | null,
        subscriptionGroupId?: string,
      ): Promise<AscReviewVersionItem | null> => {
        if (!dryRun) await checkCancelled();
        if (rowHadFailure) return null;
        if (!reviewVersion) {
          recordFailure({
            productId: `${row.productId} (review version)`,
            reason: "ASC review version was not prepared",
          });
          return null;
        }
        const disposition = getAscReviewFinalizeDisposition({
          alreadySubmitted: reviewVersion.alreadySubmitted,
          attachedToSubmission: reviewVersion.attachedToSubmission,
          screenshotConfigured: screenshotMetadata !== null,
        });
        if (dryRun) {
          if (disposition === "already-submitted") {
            plannedWrites.push({
              productId: row.productId,
              step: "no App Review write required",
              detail:
                "The current review version is already submitted or approved.",
            });
            pushed += 1;
            return null;
          }
          if (disposition === "attached") {
            const action: AscManualReviewAction = {
              productId: row.productId,
              code: "review_submission_conflict",
              message:
                "This product version is already attached to an existing App Store Connect review submission. Complete or discard that draft there; IAPKit will not attach it to a second submission.",
            };
            manualActions.push(action);
            plannedWrites.push({
              productId: row.productId,
              step: "manual App Store review submission required",
              detail: action.message,
            });
            return null;
          }
          if (disposition === "ready") {
            plannedWrites.push({
              productId: row.productId,
              step: "skip automatic App Review submission",
              detail:
                "No optional project App Review screenshot is configured; product will stop at Ready.",
            });
            pushed += 1;
            return null;
          }
          if (reviewScreenshotError || !reviewScreenshot) {
            recordFailure({
              productId: `${row.productId} (review screenshot)`,
              reason:
                reviewScreenshotError?.message ??
                "Configured App Review screenshot could not be read",
            });
            return null;
          }
          plannedWrites.push({
            productId: row.productId,
            step: "upload App Review screenshot",
            detail: `${screenshotMetadata!.fileName} (${kind})`,
          });
          const eligibilityActions = await loadEligibilityActions({
            productId: row.productId,
            storeRef,
            kind,
            productType,
            versionId: reviewVersion.versionId,
            ...(subscriptionGroupId ? { subscriptionGroupId } : {}),
          });
          if (!eligibilityActions) return null;
          if (eligibilityActions.length > 0) {
            manualActions.push(...eligibilityActions);
            plannedWrites.push({
              productId: row.productId,
              step: "manual App Store review submission required",
              detail: eligibilityActions
                .map((action) => action.message)
                .join(" "),
            });
          } else {
            plannedWrites.push({
              productId: row.productId,
              step: "submit review version",
              detail:
                "Create a review submission item and submit the eligible version.",
            });
            pushed += 1;
          }
          return null;
        }
        if (disposition === "already-submitted") {
          await ctx.runMutation(internal.products.sync.markPushed, {
            projectId: project._id,
            productId: row.productId,
            platform: "IOS",
            storeRef,
            reviewScreenshotFileId: screenshotMetadata?.fileId,
          });
          pushed += 1;
          return null;
        }
        if (disposition === "attached") {
          manualActions.push({
            productId: row.productId,
            code: "review_submission_conflict",
            message:
              "This product version is already attached to an existing App " +
              "Store Connect review submission. Complete or discard that " +
              "draft there; IAPKit will not attach it to a second submission.",
          });
          return null;
        }
        if (disposition === "ready") {
          await ctx.runMutation(internal.products.sync.markPushed, {
            projectId: project._id,
            productId: row.productId,
            platform: "IOS",
            storeRef,
          });
          pushed += 1;
          return null;
        }
        const reviewItem: AscReviewVersionItem = {
          productId: row.productId,
          storeRef,
          kind,
          productType,
          versionId: reviewVersion.versionId,
          ...(subscriptionGroupId ? { subscriptionGroupId } : {}),
        };
        if (reviewScreenshotError || !reviewScreenshot) {
          recordFailure({
            productId: `${row.productId} (review screenshot)`,
            reason:
              reviewScreenshotError?.message ??
              "Configured App Review screenshot could not be read",
          });
          return null;
        }
        try {
          await uploadAscReviewScreenshot({
            request: reviewRequest,
            kind,
            parentId: storeRef,
            screenshot: reviewScreenshot,
            checkCancelled,
          });
        } catch (error) {
          if (isProductSyncAbortError(error)) throw error;
          recordFailure({
            productId: `${row.productId} (review screenshot)`,
            reason: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
        const eligibilityActions = await loadEligibilityActions(reviewItem);
        if (!eligibilityActions) return null;
        if (eligibilityActions.length > 0) {
          manualActions.push(...eligibilityActions);
          // Keep this row retryable. If another concurrent worker aborts the
          // job, the in-memory manual action is lost; leaving the row Draft
          // guarantees the next run surfaces the operator action again.
          return null;
        }
        return reviewItem;
      };
      try {
        if (row.type === "Subscription") {
          // Without a group name, default to the productId rather than fail,
          // with a warning: per-product groups break StoreKit 2 upgrades and
          // downgrades between tiers, which must share a group. A row with a
          // storeRef skips group resolution and create, which would duplicate
          // or 409.
          const groupName = row.subscriptionGroupName ?? row.productId;
          let reviewGroupId = row.subscriptionGroupId;
          if (!reviewGroupId && row.storeRef && reviewEligibility) {
            reviewGroupId =
              (await reviewEligibility.resolveSubscriptionGroupId(groupName)) ??
              undefined;
          }
          if (!row.subscriptionGroupName && !row.storeRef && dryRun) {
            // Warn only in the preview; in `failures` it would block markPushed
            // on a real sync.
            plannedWrites.push({
              productId: row.productId,
              step: "warning: no subscription group name set",
              detail:
                "Falling back to productId so this sub lands in its own group. Pick a shared name (e.g. 'Premium') for related tiers so StoreKit 2 upgrade/downgrade works.",
            });
          }
          let storeRef: string;
          if (row.storeRef) {
            storeRef = row.storeRef;
            if (dryRun) {
              plannedWrites.push({
                productId: row.productId,
                step: "skip create (resuming partial sync)",
                detail: `existing storeRef=${storeRef}`,
              });
              plannedWrites.push({
                productId: row.productId,
                step: "patch subscription",
                detail: row.title,
              });
            } else {
              await client.patchSubscription(storeRef, {
                name: row.title,
                reviewNote: row.reviewNote,
              });
            }
          } else {
            let groupId: string;
            if (dryRun) {
              const groups = await ensureDryRunGroups();
              const existing = groups.data.find(
                (g) => g.attributes.referenceName === groupName,
              );
              groupId = existing?.id ?? "(would-create)";
              reviewGroupId = existing?.id;
              plannedWrites.push({
                productId: row.productId,
                step: existing
                  ? "use existing subscription group"
                  : "create subscription group",
                detail: groupName,
              });
              storeRef = "(would-create)";
              plannedWrites.push({
                productId: row.productId,
                step: "create subscription",
                detail: `${row.title} · ${mapBillingPeriodToAsc(row.billingPeriod)} · group=${groupName}`,
              });
            } else {
              let cached = groupIdCache.get(groupName);
              if (!cached) {
                cached = client.findOrCreateSubscriptionGroup({
                  appId: appIdStr,
                  referenceName: groupName,
                });
                groupIdCache.set(groupName, cached);
                // Evict a rejected promise so a later draft can retry.
                cached.catch(() => {
                  if (groupIdCache.get(groupName) === cached) {
                    groupIdCache.delete(groupName);
                  }
                });
              }
              groupId = await cached;
              reviewGroupId = groupId;
              const result = await client.createSubscription({
                groupId,
                productId: row.productId,
                name: row.title,
                subscriptionPeriod: mapBillingPeriodToAsc(row.billingPeriod),
                reviewNote: row.reviewNote,
              });
              storeRef = result.data.id;
              // Persist the id now so a later step's failure keeps the binding
              // and the next sync skips create.
              await ctx.runMutation(internal.products.sync.markStoreRef, {
                projectId: project._id,
                productId: row.productId,
                platform: "IOS",
                storeRef,
              });
            }
          }
          const reviewVersion = await resolveReviewVersion(
            "subscription",
            storeRef,
          );
          // ASC needs a locale before submission. A failure here cannot undo
          // the create (Apple has no rollback), so it is recorded for a retry.
          if (dryRun && reviewVersion) {
            if (
              reviewVersion.alreadySubmitted ||
              reviewVersion.attachedToSubmission
            ) {
              const mismatchedLocale = await ascReviewLocalizationMismatch({
                request: reviewRequest,
                kind: "subscription",
                versionId: reviewVersion.versionId,
                listings: listingRowsForProduct(row),
                checkCancelled,
              });
              const matches = mismatchedLocale === undefined;
              if (!matches) {
                recordFailure({
                  productId: `${row.productId} (review version)`,
                  reason: `The current ASC review version is already attached or submitted and its ${mismatchedLocale} metadata differs from this Draft.`,
                });
              } else {
                plannedWrites.push({
                  productId: row.productId,
                  step: "keep locked version localizations",
                  detail: `Current ASC metadata already matches (${listingRowsForProduct(
                    row,
                  )
                    .map((listing) => listing.locale)
                    .join(", ")}).`,
                });
              }
            } else {
              // One planned line per locale: the real push writes them
              // all, so a preview that mentioned only en-US would hide
              // exactly the translations the operator is verifying.
              for (const listing of listingRowsForProduct(row)) {
                plannedWrites.push({
                  productId: row.productId,
                  step: row.storeRef
                    ? `patch ${listing.locale} version localization`
                    : `create ${listing.locale} version localization`,
                  detail: listing.description ?? listing.title,
                });
              }
            }
          } else if (reviewVersion) {
            await syncReviewLocalization("subscription", reviewVersion);
          }
          // USD only: we only know the USA tier ladder, so other currencies
          // fail with a clear reason instead of being mis-priced. Dry runs skip
          // the lookup, since nothing was created to read back.
          if (
            row.priceAmountMicros !== undefined &&
            (row.currency ?? "USD") === "USD"
          ) {
            if (dryRun) {
              plannedWrites.push({
                productId: row.productId,
                step: "set USA price",
                detail: `USD ${(row.priceAmountMicros / 1_000_000).toFixed(2)}`,
              });
            } else {
              try {
                const currentPrice = await client.subCurrentPrice(storeRef);
                const assigned =
                  currentPrice instanceof Error
                    ? {}
                    : parseAssignedPrice(
                        currentPrice,
                        "subscriptionPricePoint",
                      );
                if (assigned.priceAmountMicros !== row.priceAmountMicros) {
                  const pricePointId = await client.findSubUsaPricePointId(
                    storeRef,
                    row.priceAmountMicros,
                  );
                  if (!pricePointId) {
                    recordFailure({
                      productId: `${row.productId} (price)`,
                      reason: `No ASC price tier matches USD ${(row.priceAmountMicros / 1_000_000).toFixed(2)} — pick a published tier amount.`,
                    });
                  } else {
                    await client.setSubPriceSchedule({
                      subId: storeRef,
                      pricePointId,
                    });
                  }
                }
              } catch (error) {
                if (isProductSyncAbortError(error)) throw error;
                // Treat only duplicate/existing conflicts as benign
                // retries. ASC also reports malformed price payloads
                // as 409 ENTITY_ERROR, and those must stay visible.
                if (!isBenignAscRetryConflict(error)) {
                  recordFailure({
                    productId: `${row.productId} (price)`,
                    reason:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              }
            }
          } else if (row.currency && row.currency !== "USD") {
            recordFailure({
              productId: `${row.productId} (price)`,
              reason: `Non-USD pricing (${row.currency}) not supported in push yet — set USD on the catalog row or configure other territories in ASC web.`,
            });
          }
          return await finalizeReview(
            "subscription",
            storeRef,
            "Subscription",
            reviewVersion,
            reviewGroupId,
          );
        } else {
          let storeRef: string;
          let reviewProductType: AscReviewVersionItem["productType"] = row.type;
          if (row.storeRef) {
            storeRef = row.storeRef;
            if (dryRun) {
              plannedWrites.push({
                productId: row.productId,
                step: "skip create (resuming partial sync)",
                detail: `existing storeRef=${storeRef}`,
              });
              plannedWrites.push({
                productId: row.productId,
                step: "patch in-app purchase",
                detail: row.title,
              });
            } else {
              await client.patchInAppPurchase(storeRef, {
                name: row.title,
                reviewNote: row.reviewNote,
              });
            }
            if (screenshotMetadata) {
              const cached = ascReviewProductTypeByStoreRef.get(storeRef);
              if (cached) {
                reviewProductType = cached;
              } else {
                const current = await client.getInAppPurchase(storeRef);
                reviewProductType = mapAscReviewProductType(
                  current.data.attributes.inAppPurchaseType,
                  row.type,
                );
                ascReviewProductTypeByStoreRef.set(storeRef, reviewProductType);
              }
            }
          } else if (dryRun) {
            storeRef = "(would-create)";
            plannedWrites.push({
              productId: row.productId,
              step: "create in-app purchase",
              detail: `${row.title} · ${row.type}`,
            });
          } else {
            const result = await client.createInAppPurchase({
              appId: appIdStr,
              productId: row.productId,
              name: row.title,
              type: row.type === "Consumable" ? "CONSUMABLE" : "NON_CONSUMABLE",
              reviewNote: row.reviewNote,
            });
            storeRef = result.data.id;
            reviewProductType = mapAscReviewProductType(
              result.data.attributes.inAppPurchaseType,
              row.type,
            );
            // Persist the id before steps that may fail, as for subscriptions.
            await ctx.runMutation(internal.products.sync.markStoreRef, {
              projectId: project._id,
              productId: row.productId,
              platform: "IOS",
              storeRef,
            });
          }
          const reviewVersion = await resolveReviewVersion("iap", storeRef);
          if (dryRun && reviewVersion) {
            if (
              reviewVersion.alreadySubmitted ||
              reviewVersion.attachedToSubmission
            ) {
              const mismatchedLocale = await ascReviewLocalizationMismatch({
                request: reviewRequest,
                kind: "iap",
                versionId: reviewVersion.versionId,
                listings: listingRowsForProduct(row),
                checkCancelled,
              });
              const matches = mismatchedLocale === undefined;
              if (!matches) {
                recordFailure({
                  productId: `${row.productId} (review version)`,
                  reason: `The current ASC review version is already attached or submitted and its ${mismatchedLocale} metadata differs from this Draft.`,
                });
              } else {
                plannedWrites.push({
                  productId: row.productId,
                  step: "keep locked version localizations",
                  detail: `Current ASC metadata already matches (${listingRowsForProduct(
                    row,
                  )
                    .map((listing) => listing.locale)
                    .join(", ")}).`,
                });
              }
            } else {
              // One planned line per locale: the real push writes them
              // all, so a preview that mentioned only en-US would hide
              // exactly the translations the operator is verifying.
              for (const listing of listingRowsForProduct(row)) {
                plannedWrites.push({
                  productId: row.productId,
                  step: row.storeRef
                    ? `patch ${listing.locale} version localization`
                    : `create ${listing.locale} version localization`,
                  detail: listing.description ?? listing.title,
                });
              }
            }
          } else if (reviewVersion) {
            await syncReviewLocalization("iap", reviewVersion);
          }
          if (
            row.priceAmountMicros !== undefined &&
            (row.currency ?? "USD") === "USD"
          ) {
            if (dryRun) {
              plannedWrites.push({
                productId: row.productId,
                step: "set USA price",
                detail: `USD ${(row.priceAmountMicros / 1_000_000).toFixed(2)}`,
              });
            } else {
              try {
                const currentPrice = await client.iapCurrentPrice(storeRef);
                const assigned =
                  currentPrice instanceof Error
                    ? {}
                    : parseAssignedPrice(
                        currentPrice,
                        "inAppPurchasePricePoint",
                      );
                if (assigned.priceAmountMicros !== row.priceAmountMicros) {
                  const pricePointId = await client.findIapUsaPricePointId(
                    storeRef,
                    row.priceAmountMicros,
                  );
                  if (!pricePointId) {
                    recordFailure({
                      productId: `${row.productId} (price)`,
                      reason: `No ASC price tier matches USD ${(row.priceAmountMicros / 1_000_000).toFixed(2)} — pick a published tier amount.`,
                    });
                  } else {
                    await client.setIapPriceSchedule({
                      iapId: storeRef,
                      pricePointId,
                    });
                  }
                }
              } catch (error) {
                if (isProductSyncAbortError(error)) throw error;
                // Treat only duplicate/existing conflicts as benign
                // retries. ASC also reports malformed price payloads
                // as 409 ENTITY_ERROR, and those must stay visible.
                if (!isBenignAscRetryConflict(error)) {
                  recordFailure({
                    productId: `${row.productId} (price)`,
                    reason:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              }
            }
          } else if (row.currency && row.currency !== "USD") {
            recordFailure({
              productId: `${row.productId} (price)`,
              reason: `Non-USD pricing (${row.currency}) not supported in push yet — set USD on the catalog row or configure other territories in ASC web.`,
            });
          }
          return await finalizeReview(
            "iap",
            storeRef,
            reviewProductType,
            reviewVersion,
          );
        }
      } catch (error) {
        if (isProductSyncAbortError(error)) throw error;
        recordFailure({
          productId: row.productId,
          reason: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    };
    let processedDrafts = 0;
    let stoppedAfterSubmission = false;
    for (
      let offset = 0;
      offset < drafts.length;
      offset += ASC_REVIEW_SYNC_BATCH_LIMIT
    ) {
      await checkCancelled();
      const chunk = drafts.slice(offset, offset + ASC_REVIEW_SYNC_BATCH_LIMIT);
      const reviewItems = (
        await mapWithConcurrency(chunk, PUSH_CONCURRENCY, processOneDraft)
      ).filter((item): item is AscReviewVersionItem => item !== null);
      processedDrafts += chunk.length;
      await reportPhase("push-drafts", {
        current: processedDrafts,
        total: drafts.length,
        failuresCount: failures.length,
      });

      // Dry-run never returns submission items; continue so its read-only plan
      // covers the full candidate set. Batches containing only failures/manual
      // gates also continue, preventing one bad prefix from starving later rows.
      if (reviewItems.length === 0) continue;

      await checkCancelled();
      await reportPhase("submit-review", {
        current: processedDrafts,
        total: drafts.length,
        failuresCount: failures.length,
      });
      try {
        const { selected: submissionItems, deferred: preparedDeferred } =
          partitionAscReviewSubmissionItems(reviewItems);
        if (preparedDeferred.length > 0) {
          failures.push({
            productId: "(review submission capacity)",
            reason:
              `Apple limits one review submission to ${ASC_REVIEW_SUBMISSION_ITEM_LIMIT} items. ` +
              `${preparedDeferred.length} prepared product(s) remain Draft.`,
          });
        }
        const submission = await submitAscReviewVersions({
          request: reviewRequest,
          cleanupRequest: reviewCleanupRequest,
          appId: appIdStr,
          items: submissionItems,
          checkCancelled,
          isAbortError: isProductSyncAbortError,
        });
        for (const outcome of submission.outcomes) {
          if (outcome.status === "failed") {
            failures.push({
              productId: `${outcome.item.productId} (review submission)`,
              reason: outcome.reason,
            });
            continue;
          }
          if (outcome.status === "manual") {
            manualActions.push(outcome.action);
          }
          if (!shouldMarkAscReviewSubmissionOutcomePushed(outcome)) continue;
          await ctx.runMutation(internal.products.sync.markPushed, {
            projectId: project._id,
            productId: outcome.item.productId,
            platform: "IOS",
            storeRef: outcome.item.storeRef,
            reviewScreenshotFileId: screenshotMetadata?.fileId,
          });
          pushed += 1;
        }
        if (submission.globalFailure) {
          failures.push({
            productId: "(review submission)",
            reason: submission.globalFailure,
          });
        }
      } catch (error) {
        if (isProductSyncAbortError(error)) throw error;
        failures.push({
          productId: "(review submission)",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      // ASC permits one active review submission. Finish this deterministic
      // prepare→submit unit and leave the remaining Draft rows for a later job
      // rather than preparing resources that cannot be submitted this run.
      stoppedAfterSubmission = true;
      break;
    }
    if (stoppedAfterSubmission && processedDrafts < drafts.length) {
      failures.push({
        productId: "(review submission batch)",
        reason:
          `${drafts.length - processedDrafts} product(s) remain Draft after this bounded ` +
          `batch of ${ASC_REVIEW_SYNC_BATCH_LIMIT}. Run Push Sync again after the current ` +
          "App Store Connect review submission is no longer active.",
      });
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

// Read-only group list for the dashboard's subscription-group autocomplete. On
// error the dashboard shows a toast and the field stays free text.
export const listSubscriptionGroupsAppleIOS = action({
  args: {
    apiKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.array(v.object({ id: v.string(), referenceName: v.string() })),
  handler: async (
    ctx,
    args,
  ): Promise<Array<{ id: string; referenceName: string }>> => {
    const project = await getProjectForActionArgs(ctx, args);
    if (!project.iosAppAppleId) {
      throw new Error("Project iosAppAppleId is not configured");
    }
    const { issuerId, keyId, keyContent } = await resolveAscCredentials(
      ctx,
      project,
    );
    const client = new AscClient(issuerId, keyId, keyContent);
    const resp = await client.listSubscriptionGroups(
      String(project.iosAppAppleId),
    );
    return resp.data
      .map((g) => ({
        id: g.id,
        referenceName: g.attributes.referenceName ?? "",
      }))
      .filter((g) => g.referenceName.length > 0);
  },
});

export function mapBillingPeriodToAsc(
  period: string | undefined,
):
  | "ONE_WEEK"
  | "ONE_MONTH"
  | "TWO_MONTHS"
  | "THREE_MONTHS"
  | "SIX_MONTHS"
  | "ONE_YEAR" {
  switch (period) {
    case "P1W":
      return "ONE_WEEK";
    case "P1M":
    case undefined:
      // A missing period is usually an unfilled optional field; monthly is the
      // least destructive guess.
      return "ONE_MONTH";
    case "P2M":
      return "TWO_MONTHS";
    case "P3M":
      return "THREE_MONTHS";
    case "P6M":
      return "SIX_MONTHS";
    case "P1Y":
      return "ONE_YEAR";
    default:
      // Throw rather than guess: a wrong duration in ASC is much harder to undo
      // than a failed sync.
      throw new Error(
        `Invalid billing period for ASC subscription: "${period}". ` +
          `Expected one of P1W, P1M, P2M, P3M, P6M, P1Y (or omit for monthly).`,
      );
  }
}

function mapAscIapType(
  raw: string | undefined,
): "Subscription" | "NonConsumable" | "Consumable" {
  switch (raw) {
    case "CONSUMABLE":
      return "Consumable";
    case "NON_RENEWING_SUBSCRIPTION":
    case "NON_CONSUMABLE":
      return "NonConsumable";
    default:
      return "NonConsumable";
  }
}

export function mapAscReviewProductType(
  raw: string | undefined,
  fallback: "Subscription" | "NonConsumable" | "Consumable",
): AscReviewVersionItem["productType"] {
  switch (raw) {
    case "CONSUMABLE":
      return "Consumable";
    case "NON_CONSUMABLE":
      return "NonConsumable";
    case "NON_RENEWING_SUBSCRIPTION":
      return "NonRenewingSubscription";
    default:
      return fallback;
  }
}

// Apple's intro-offer durations are enums; map them to ISO 8601 to match Play.
// Unknown values pass through so a new Apple value still renders.
export function mapAscOfferDurationToIso(
  raw: string | undefined,
): string | undefined {
  if (!raw) return undefined;
  switch (raw) {
    case "THREE_DAYS":
      return "P3D";
    case "ONE_WEEK":
      return "P1W";
    case "TWO_WEEKS":
      return "P2W";
    case "ONE_MONTH":
      return "P1M";
    case "TWO_MONTHS":
      return "P2M";
    case "THREE_MONTHS":
      return "P3M";
    case "SIX_MONTHS":
      return "P6M";
    case "ONE_YEAR":
      return "P1Y";
    default:
      return raw;
  }
}

export function mapAscOfferKind(
  mode: string | undefined,
): "FreeTrial" | "IntroPayUpFront" | "IntroPayAsYouGo" {
  switch (mode) {
    case "PAY_UP_FRONT":
      return "IntroPayUpFront";
    case "PAY_AS_YOU_GO":
      return "IntroPayAsYouGo";
    case "FREE_TRIAL":
    default:
      return "FreeTrial";
  }
}

// ASC intro offers active today, as kit `offers[]`; free trials have no price.
export function parseIntroOffers(
  resp: AscIntroOfferListResponse | null,
): Array<{
  id: string;
  kind: "FreeTrial" | "IntroPayUpFront" | "IntroPayAsYouGo";
  duration?: string;
  numberOfPeriods?: number;
  priceAmountMicros?: number;
  currency?: string;
}> {
  if (!resp || resp.data.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  return resp.data
    .filter((row) => {
      const start = row.attributes?.startDate ?? null;
      const end = row.attributes?.endDate ?? null;
      if (start && start > today) return false;
      if (end && end < today) return false;
      return true;
    })
    .map((row) => {
      const pointId = row.relationships?.subscriptionPricePoint?.data?.id;
      const point = pointId
        ? resp.included?.find((entry) => entry.id === pointId)
        : undefined;
      const priceAmountMicros = ascCustomerPriceToMicros(
        point?.attributes?.customerPrice,
      );
      return {
        id: row.id,
        kind: mapAscOfferKind(row.attributes?.offerMode),
        duration: mapAscOfferDurationToIso(row.attributes?.duration),
        numberOfPeriods: row.attributes?.numberOfPeriods,
        priceAmountMicros,
        currency: priceAmountMicros !== undefined ? "USD" : undefined,
      };
    });
}

function mapAscState(
  raw: string | undefined,
): "Draft" | "Ready" | "Active" | "Removed" {
  switch (raw) {
    case "WAITING_FOR_REVIEW":
    case "IN_REVIEW":
    case "PENDING_DEVELOPER_RELEASE":
    case "PENDING_BINARY_APPROVAL":
    case "READY_TO_SUBMIT":
    case "READY_FOR_REVIEW":
      return "Ready";
    case "APPROVED":
    case "REPLACED":
      return "Active";
    case "DEVELOPER_REMOVED_FROM_SALE":
    case "REMOVED_FROM_SALE":
      return "Removed";
    default:
      return "Draft";
  }
}
