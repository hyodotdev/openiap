"use node";
import { v } from "convex/values";

import { action, internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getProjectByApiKey } from "../purchases/shared";
import { mapWithConcurrency } from "../utils/concurrency";
import { mintAscJwt } from "./jwt";
import { coerceBillingPeriod } from "./sync";

// Cancel-check at phase boundaries. The worker reads
// `cancelRequested` between PULL.iaps → PULL.subgroups → PUSH.drafts.
// Granularity is per-phase, not per-product, but that's enough to
// stop a runaway sync within seconds on most paths.
class ProductSyncCancelledError extends Error {
  constructor() {
    super("Sync cancelled by operator");
    this.name = "ProductSyncCancelledError";
  }
}

// Resolve App Store Connect API credentials (issuer ID + key ID + .p8
// key content) for a project. Centralized so the two action handlers
// (pushSyncProductsAppleIOS and listSubscriptionGroupsAppleIOS) share
// one source of truth — both have to honor the same pair-resolution
// rule (never mix new ASC slot with legacy Server API slot) and the
// same .p8 fallback (dedicated ASC slot first, then legacy single
// slot for projects mid-migration). Throws on missing config or
// missing .p8 with the operator-actionable message we want surfaced.
type AscCredentials = {
  issuerId: string;
  keyId: string;
  keyContent: string;
};
async function resolveAscCredentials(
  ctx: ActionCtx,
  project: Awaited<ReturnType<typeof getProjectByApiKey>>,
  options: { detailedErrors?: boolean } = {},
): Promise<AscCredentials> {
  // Apple uses ONE Issuer ID per team across both API gateways
  // (App Store Server API + App Store Connect API), so the
  // Settings UI deliberately exposes a single shared Issuer ID
  // input that writes to `iosAppStoreIssuerId` — `iosAscIssuerId`
  // is never populated through the UI and only exists for
  // backwards-compat with the brief window when both were
  // separate inputs.
  //
  // The Key IDs are NOT shared: `iosAppStoreKeyId` is the In-App
  // Purchase key (receipt verification) and `iosAscKeyId` is the
  // App Store Connect API Team / Individual key (catalog
  // management). They authenticate against different gateways and
  // every Apple-issued key has a unique 10-char id.
  //
  // Pair-resolution rule: if `iosAscKeyId` is set, sign with the
  // ASC pair (issuer falls back to the shared `iosAppStoreIssuerId`
  // when `iosAscIssuerId` is missing). If `iosAscKeyId` is missing,
  // fall back to the legacy single-slot Server API pair so projects
  // mid-migration still work — `call()` surfaces a wrong-kind 401
  // hint when Apple rejects a Server-API key on an ASC endpoint.
  //
  // Earlier the gate required BOTH `iosAscIssuerId` AND
  // `iosAscKeyId` to be set, which never happened in production
  // (UI doesn't expose the Issuer field). The fallback then sent
  // the JWT with `kid: iosAppStoreKeyId` (Server API key id) but
  // signed with the ASC private key, and Apple rejected every
  // request with a 401 across all production deployments
  // (LukasB-DEV's report on PR #127).
  const useAsc = !!project.iosAscKeyId;
  const issuerId = useAsc
    ? (project.iosAscIssuerId ?? project.iosAppStoreIssuerId)
    : project.iosAppStoreIssuerId;
  const keyId = useAsc ? project.iosAscKeyId : project.iosAppStoreKeyId;
  if (!issuerId || !keyId) {
    throw new Error(
      options.detailedErrors
        ? "App Store Connect API Issuer ID / Key ID not configured. " +
            "Generate them at App Store Connect → Users and Access → " +
            "Integrations → App Store Connect API (NOT under In-App " +
            "Purchase — those credentials are scoped to receipt " +
            "verification only). Save them in Settings → iOS " +
            "Configuration → 'App Store Connect API (push-sync)'."
        : "App Store Connect API Issuer ID / Key ID not configured",
    );
  }
  // Prefer the dedicated ASC .p8 file; fall back to the Server API
  // .p8 when the user has only uploaded one. The wrong-kind hint
  // from `call()` will tell them to upload a Team Key if Apple
  // rejects whichever they have.
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
    // Only swallow the documented "no ASC key uploaded" case so we
    // can fall through to the legacy slot. Storage / permission /
    // transient errors must surface — masking them as "use legacy
    // key" hides the real failure and ends up signing requests with
    // the wrong key, producing confusing 401s downstream.
    //
    // The action throws a ConvexError whose message starts with
    // "No App Store Connect API key (.p8) uploaded" when the file is
    // missing. Anything else rethrows.
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

// App Store Connect REST client + push-sync action.
//
// Auth: every request carries a freshly-minted ES256 JWT signed with
// the project's `.p8` key (already stored for App Store Server API
// reuse). Token TTL is 600s with a 60s safety margin before expiry.
//
// Surface area implemented (matches what `@onesub/providers` exposes):
//   - listInAppPurchases(appId)  → GET /v1/apps/{id}/inAppPurchasesV2
//   - createInAppPurchase(args)  → POST /v1/inAppPurchases
//   - patchInAppPurchase(id,...) → PATCH /v1/inAppPurchases/{id}
//   - listSubscriptionGroups(appId) → GET /v1/apps/{id}/subscriptionGroups
//   - listSubscriptions(groupId) → GET /v1/subscriptionGroups/{id}/subscriptions
//   - createSubscription(...)    → POST /v1/subscriptions
//   - patchSubscription(...)     → PATCH /v1/subscriptions/{id}
// The `pushSyncProducts` action drives kit→ASC sync for a project.
//
// Failure model: ASC returns an `errors[]` array per the JSON:API
// spec; we throw the response status + the first error's `detail` so
// the dashboard / MCP / SDK surfaces a useful message instead of
// "fetch failed".

const ASC_BASE = "https://api.appstoreconnect.apple.com";
const ASC_FETCH_TIMEOUT_MS = 30_000;

type AscToken = { value: string; expiresAt: number };

/**
 * Thrown by `AscClient.call` on any non-OK ASC response. The status
 * code is preserved so callers can branch on it — e.g. ignore 409
 * Conflict on retried `createSubLocalization` / `createIapLocalization`
 * pushes (the upstream resource already exists, the next step still
 * applies). Earlier behaviour threw a generic `Error` and forced the
 * caller to substring-match the message; this is the typed version.
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

class AscClient {
  private cached: AscToken | null = null;

  constructor(
    private readonly issuerId: string,
    private readonly keyId: string,
    private readonly privateKey: string,
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
  ): Promise<T> {
    // Per-request timeout. ASC's REST surface is generally responsive
    // (<1s for reads, 1-3s for writes), so 30s is a generous bound
    // that catches a hung upstream long before the surrounding
    // Convex action's 10-min ceiling. Without this, a single hung
    // request can stall the entire push-sync pass — ASC has no
    // server-sent keepalive on the REST endpoints.
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
      // Apple's 401 is the same generic "Provide a properly configured
      // and signed bearer token" for several distinct failure modes,
      // and the most common one — uploading the In-App Purchase Key
      // instead of the App Store Connect API (Team / Individual) Key
      // — looks indistinguishable from "expired token" or "wrong
      // signature" without context. Surface a targeted hint so the
      // operator stops debugging the JWT and starts checking the
      // *kind* of key they uploaded.
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
      // Use a typed AscApiError so callers can branch on
      // `.status === 409` to ignore "already exists" replays during
      // retried localization / price-schedule pushes (PR #124
      // (https://github.com/hyodotdev/openiap/pull/124) review).
      throw new AscApiError(response.status, message);
    }
    return parsed as T;
  }

  // ASC list endpoints cap at 200 items per page. For accounts with
  // larger catalogs we have to follow `links.next` until absent or
  // pages > 200 (= 40k items, more than ASC actually allows per app
  // — the bound just prevents a runaway loop on unexpected response
  // shapes). Without pagination, accounts above the page limit silently
  // lose products from kit's catalog.
  async listInAppPurchases(appId: string): Promise<AscIapListResponse> {
    return this.collectAllPages<AscIapResource["data"]>(
      `/v1/apps/${encodeURIComponent(appId)}/inAppPurchasesV2?limit=200`,
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

  // Generic JSON:API paginator. ASC returns `{ data: [...],
  // links: { self, next? } }` — we follow `next` (the cursor URL is
  // absolute, so we hand it straight back to fetch via `call`'s base
  // join logic). Capped at 200 pages as a runaway guard.
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
      path = nextUrl ? this.relativizePath(nextUrl) : null;
      pages += 1;
    }
    return { data: merged };
  }

  // ASC `links.next` is fully qualified (`https://api.appstoreconnect…`).
  // `call()` already prepends ASC_BASE, so strip the host before
  // passing it back in.
  private relativizePath(absoluteOrRelative: string): string {
    if (absoluteOrRelative.startsWith(ASC_BASE)) {
      return absoluteOrRelative.slice(ASC_BASE.length);
    }
    return absoluteOrRelative;
  }

  // Introductory offer attached to a subscription. Apple allows at
  // most ONE introductoryOffer per subscription per territory at a
  // time — the prior `pay-up-front $0.99 for 3 months` is replaced
  // when you publish a new one. We pull the USA territory's active
  // offer (if any) so the dashboard can render badges like
  // "7-day free trial" / "$0.99 intro for 3 months". Returns Error
  // so the caller can append a failure row instead of silently
  // dropping offer metadata.
  async subIntroductoryOffer(
    subId: string,
  ): Promise<AscIntroOfferListResponse | Error> {
    try {
      return await this.call<AscIntroOfferListResponse>(
        `/v1/subscriptions/${encodeURIComponent(subId)}/introductoryOffers?filter[territory]=USA&include=subscriptionPricePoint&limit=10`,
      );
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }

  // Per-product *configured* USA price. The naive
  // `/{type}/{id}/pricePoints?filter[territory]=USA&limit=1` endpoint
  // returns the entire USA *price matrix* (every tier the catalog
  // offers — $0.29, $0.49, $0.99, …), not the price the operator
  // assigned to the product, so `limit=1` always pinned the lowest
  // tier and every IAP / sub showed up as $0.29. The actual assigned
  // price lives on a different relationship — `iapPriceSchedule` for
  // one-time IAPs, `prices` for subscriptions — with the matching
  // pricePoint side-loaded via `include`.
  // Returns either the price response or an Error so the caller can
  // surface the actual ASC reason (404, 403, malformed schedule, …)
  // through the sync result's `failures` array — silently swallowing
  // these is what made one-time IAPs show "—" with no diagnostic.
  async iapCurrentPrice(
    iapId: string,
  ): Promise<AscManualPricesResponse | Error> {
    // v2 IAPs expose the price-schedule relationship under `/v2/`
    // (the per-resource endpoints moved with the V2 catalog), even
    // though the catalog list is `/v1/apps/{id}/inAppPurchasesV2`
    // and the JSON:API resource type is still `"inAppPurchases"`. The
    // older `/v1/inAppPurchases/{id}/iapPriceSchedule` 404s with
    // "relationship 'iapPriceSchedule' does not exist" because that
    // path resolves to the legacy V1 IAP resource which has no such
    // relationship. The downstream `manualPrices` collection lookup
    // stays on `/v1/inAppPurchasePriceSchedules/...`.
    try {
      const schedule = await this.call<AscIapPriceScheduleResponse>(
        `/v2/inAppPurchases/${encodeURIComponent(iapId)}/iapPriceSchedule`,
      );
      if (!schedule?.data?.id) {
        return new Error(
          "iapPriceSchedule returned no data — IAP has no price schedule yet",
        );
      }
      const manual = await this.call<AscManualPricesResponse>(
        `/v1/inAppPurchasePriceSchedules/${encodeURIComponent(schedule.data.id)}/manualPrices?filter[territory]=USA&include=inAppPurchasePricePoint`,
      );
      // When the IAP uses Apple's equalized auto-pricing instead of
      // per-territory manual prices, `manualPrices` comes back empty
      // and the assigned USA price actually lives on the parallel
      // `automaticPrices` collection (same envelope shape).
      if (manual.data.length === 0) {
        return await this.call<AscManualPricesResponse>(
          `/v1/inAppPurchasePriceSchedules/${encodeURIComponent(schedule.data.id)}/automaticPrices?filter[territory]=USA&include=inAppPurchasePricePoint`,
        );
      }
      return manual;
    } catch (error) {
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
      return error instanceof Error ? error : new Error(String(error));
    }
  }

  // Find a USA price-point id whose `customerPrice` matches the
  // requested USD amount. Apple manages prices via opaque tier ids
  // (eyJ...) — to set a price you can't just send "9.99", you must
  // pass the price-point resource id corresponding to that tier in
  // USA. We fetch the catalog once per (resource, amount) lookup.
  //
  // Errors propagate verbatim so the call site can distinguish
  // "no tier matches USD 9.99" (returns null after a successful
  // list) from "ASC returned 401 / 429 / timeout" (throws). The
  // prior `.catch(() => null)` collapsed both into the same null
  // result and surfaced a real upstream failure as a bogus catalog
  // validation error.
  async findIapUsaPricePointId(
    iapId: string,
    targetMicros: number,
  ): Promise<string | null> {
    const list = await this.call<AscPricePointListResponse>(
      `/v1/inAppPurchases/${encodeURIComponent(iapId)}/pricePoints?filter[territory]=USA&limit=200`,
    );
    return pickPricePointIdMatching(list, targetMicros);
  }
  async findSubUsaPricePointId(
    subId: string,
    targetMicros: number,
  ): Promise<string | null> {
    const list = await this.call<AscPricePointListResponse>(
      `/v1/subscriptions/${encodeURIComponent(subId)}/pricePoints?filter[territory]=USA&limit=200`,
    );
    return pickPricePointIdMatching(list, targetMicros);
  }

  // Atomically create the IAP price schedule with the chosen USA
  // price tier. Apple's pattern: POST `inAppPurchasePriceSchedules`
  // with the IAP relationship + the manualPrices relationship inline,
  // and pass the price rows in `included`. Returns the schedule id.
  setIapPriceSchedule(args: {
    iapId: string;
    pricePointId: string;
    startDate?: string; // YYYY-MM-DD; omit for "effective immediately"
  }) {
    const priceLid = "newPrice";
    const today = args.startDate ?? new Date().toISOString().slice(0, 10);
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
              manualPrices: {
                data: [{ type: "inAppPurchasePrices", id: priceLid }],
              },
            },
          },
          included: [
            {
              type: "inAppPurchasePrices",
              id: priceLid,
              attributes: { startDate: today },
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
    const priceLid = "newSubPrice";
    const today = args.startDate ?? new Date().toISOString().slice(0, 10);
    return this.call<{ data: { id: string } }>(`/v1/subscriptionPrices`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "subscriptionPrices",
          id: priceLid,
          attributes: { startDate: today },
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
          },
        },
      }),
    });
  }

  // Attach an English (US) localization so reviewers and the
  // dashboard see something other than the bare productId. Apple
  // requires at least one locale before the IAP can be submitted; we
  // always create en-US so first-submission isn't blocked.
  createIapLocalization(args: {
    iapId: string;
    name: string;
    description: string;
    locale?: string;
  }) {
    return this.call<{ data: { id: string } }>(
      `/v1/inAppPurchaseLocalizations`,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "inAppPurchaseLocalizations",
            attributes: {
              name: args.name,
              description: args.description,
              locale: args.locale ?? "en-US",
            },
            relationships: {
              inAppPurchaseV2: {
                data: { type: "inAppPurchases", id: args.iapId },
              },
            },
          },
        }),
      },
    );
  }
  createSubLocalization(args: {
    subId: string;
    name: string;
    description: string;
    locale?: string;
  }) {
    return this.call<{ data: { id: string } }>(
      `/v1/subscriptionLocalizations`,
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "subscriptionLocalizations",
            attributes: {
              name: args.name,
              description: args.description,
              locale: args.locale ?? "en-US",
            },
            relationships: {
              subscription: {
                data: { type: "subscriptions", id: args.subId },
              },
            },
          },
        }),
      },
    );
  }

  // Look up an existing subscription group by referenceName, or
  // create one. Used by the Add Product flow when the operator types
  // a group name on a Subscription draft — kit then resolves it to
  // an ASC group id at push time so they don't need to copy/paste
  // opaque ids from ASC's web console.
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
    return this.call<AscIapResource>(`/v1/inAppPurchases`, {
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
      `/v1/inAppPurchases/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: { type: "inAppPurchases", id, attributes },
        }),
      },
    );
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

// Reference catalog response: every USA price point Apple publishes
// for a given IAP / sub. Used at push-time to translate a USD amount
// into the corresponding opaque price-point id (`eyJ...`) Apple's
// price-schedule POST requires. Different shape from the
// per-product *configured* price (`AscManualPricesResponse`) — this
// is the immutable tier ladder, that one is the operator's pick.
type AscPricePointListResponse = {
  data: Array<{
    id: string;
    type: "inAppPurchasePricePoints" | "subscriptionPricePoints";
    attributes?: { customerPrice?: string };
  }>;
};

// Find the price-point id whose `customerPrice` matches the desired
// USD amount (within 1 cent for floating-point safety). Returns null
// if Apple's catalog has no matching tier — caller should surface a
// failure so the operator picks a tier ASC actually publishes.
export function pickPricePointIdMatching(
  list: AscPricePointListResponse | null,
  targetMicros: number,
): string | null {
  if (!list) return null;
  const targetCents = Math.round(targetMicros / 10_000);
  for (const point of list.data) {
    const raw = point.attributes?.customerPrice;
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const pointCents = Math.round(n * 100);
    if (Math.abs(pointCents - targetCents) <= 1) return point.id;
  }
  return null;
}

// Schedule lookup for one-time IAPs. We only need the resource id so
// we can fetch its `manualPrices` collection; relationships and
// attributes are intentionally untyped.
type AscIapPriceScheduleResponse = {
  data?: { id: string; type: "inAppPurchasePriceSchedules" } | null;
};

// `manualPrices` (one-time IAP) and `subscriptionPrices` (auto-renew
// sub) share the same JSON:API envelope: a primary `data` row that
// references a pricePoint, and the actual `customerPrice` lives on
// the side-loaded resource in `included`. We narrow only the fields
// we read.
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

// Introductory offers list. Apple's `offerMode` enum:
//   - "FREE_TRIAL"     — duration of free access; no pricePoint
//   - "PAY_UP_FRONT"   — single discounted price for N periods
//   - "PAY_AS_YOU_GO"  — discounted price each period for N periods
// `numberOfPeriods` semantics differ by mode (free trial: 1; pay-up:
// 1; pay-as-you-go: N) so we surface it as-is and let the dashboard
// label it. `subscriptionPricePoint` is included for the discounted
// price; absent for free trials.
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

// Pick the price record that's currently in effect (today between
// startDate and endDate, treating either bound's absence as "open").
// ASC normally returns just one row when no scheduled change is
// pending, but a future-dated price-change creates a second record so
// we can't just take `data[0]`.
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

// Generic shape both manual-price (one-time IAP) and subscription-
// price responses collapse into for parsing — primary row points to a
// pricePoint resource via a named relationship, included carries the
// `customerPrice`. Names of those keys vary between the two surfaces;
// we pass them in instead of branching inside.
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

// Resolve the active price record's pricePoint id and look up its
// `customerPrice` from the `included` array. Returns empty fields
// when nothing matches (no schedule, no USA price, ASC error) so the
// caller can pass the result straight into upsertFromStore.
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
  const raw = point?.attributes?.customerPrice;
  if (!raw) return {};
  const n = Number(raw);
  if (!Number.isFinite(n)) return {};
  return {
    priceAmountMicros: Math.round(n * 1_000_000),
    currency: "USD",
  };
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
// Push-sync action: pulls the project's catalog from ASC, upserts kit's
// `products` rows from it, and pushes any kit-side products with state
// = "Draft" / "Ready" upstream.
// ---------------------------------------------------------------------------

// Worker that drives a single ASC sync job. Scheduled by
// `enqueueProductSync` (in `products/jobs.ts`); never called
// directly by the dashboard / HTTP / SDK paths so the long fetch
// can never hold a browser connection open.
//
// Convex actions cap at ~10 minutes; we set the job's expected
// deadline at 9 minutes and rely on `reapStaleProductSyncJobs` to
// flip anything still running 1 minute past that to failed. Within
// the action body we also poll `isCancelRequested` at phase
// boundaries (PULL.iaps → PULL.subgroups → PUSH.drafts) so an
// operator-initiated cancel takes effect within one phase.
export const runProductSyncIOS = internalAction({
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
      const result = await performIosSync(ctx, {
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

// Shared shape for the per-phase progress callback the worker
// passes into both `performIosSync` and `performAndroidSync`. Pulled
// out so the two function signatures stay readable when extended
// (Gemini review on PR #127).
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
  failures: Array<{ productId: string; reason: string }>;
  plannedWrites?: Array<{ productId: string; step: string; detail?: string }>;
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
  // ASC push-sync uses the App Store Connect API key (Team Key /
  // Individual Key), which is genuinely different from the App Store
  // Server API key used for receipt verification — Apple scopes them
  // separately at the gateway. We prefer the dedicated ASC slot when
  // the operator has populated it, but fall back to the existing
  // Server API slot so projects that upload a Team Key into the old
  // (single-slot) workflow keep working without a re-config dance.
  // The 401 from Apple's gateway is what catches a wrong-kind key
  // either way — the helpful message in `call()` points the operator
  // at the right Apple page. The full pair-resolve + .p8-fallback
  // logic lives in `resolveAscCredentials` so the matching
  // listSubscriptionGroupsAppleIOS handler stays in lockstep.
  const { issuerId, keyId, keyContent } = await resolveAscCredentials(
    ctx,
    project,
    { detailedErrors: true },
  );
  const client = new AscClient(issuerId, keyId, keyContent);

  const direction = args.direction ?? "both";
  const failures: Array<{ productId: string; reason: string }> = [];
  let pulled = 0;
  let pushed = 0;
  const dryRun = args.dryRun ?? false;
  const plannedWrites: Array<{
    productId: string;
    step: string;
    detail?: string;
  }> = [];

  const appIdStr = String(project.iosAppAppleId);

  // ── PULL: ASC → kit catalog ────────────────────────────────────
  if (direction === "pull" || direction === "both") {
    await checkCancelled();
    await reportPhase("pull-iaps");
    const iaps = await client.listInAppPurchases(appIdStr).catch((error) => {
      failures.push({
        productId: "(asc list iaps)",
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    if (iaps) {
      // Apple throttles ASC pretty aggressively (~50 req/min);
      // concurrency=6 keeps the pull fast for catalogs with dozens
      // of IAPs while staying well clear of 429 territory. Switching
      // from a sequential await loop dropped a 30-IAP pull from
      // ~30s to ~5s in local testing.
      const iapResults = await mapWithConcurrency(
        iaps.data,
        6,
        async (item) => {
          const productId = item.attributes.productId;
          if (!productId) return null;
          const type = mapAscIapType(item.attributes.inAppPurchaseType);
          const pricePoint = await client.iapCurrentPrice(item.id);
          return { item, productId, type, pricePoint };
        },
      );
      for (const result of iapResults) {
        if (!result) continue;
        const { item, productId, type, pricePoint } = result;
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
        // upsertFromStore runs serially — Convex coalesces writes
        // anyway and parallel mutations on the same row would race
        // on the (projectId, platform, productId) lookup.
        await ctx.runMutation(internal.products.sync.upsertFromStore, {
          projectId: project._id,
          productId,
          platform: "IOS",
          type,
          title: item.attributes.name ?? productId,
          priceAmountMicros,
          currency,
          storeRef: item.id,
          state: mapAscState(item.attributes.state),
        });
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
            failures.push({
              productId: `(asc list subs in group ${group.id})`,
              reason: error instanceof Error ? error.message : String(error),
            });
            return null;
          });
        if (!subs) continue;
        // Same parallelization as the IAP loop above. Within each
        // sub, price lookup and intro-offer lookup are independent
        // — fire them as a Promise.all to halve the per-item RTT
        // before walking on to the upsert.
        const subResults = await mapWithConcurrency(
          subs.data,
          6,
          async (sub) => {
            const productId = sub.attributes.productId;
            if (!productId) return null;
            const [pricePoint, introOffers] = await Promise.all([
              client.subCurrentPrice(sub.id),
              client.subIntroductoryOffer(sub.id),
            ]);
            return { sub, productId, pricePoint, introOffers };
          },
        );
        for (const result of subResults) {
          if (!result) continue;
          const { sub, productId, pricePoint, introOffers } = result;
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
          await ctx.runMutation(internal.products.sync.upsertFromStore, {
            projectId: project._id,
            productId,
            platform: "IOS",
            type: "Subscription",
            title: sub.attributes.name ?? productId,
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
          pulled += 1;
        }
      }
    }
  }

  // ── PUSH: kit → ASC for Draft rows ─────────────────────────────
  // Each draft becomes a multi-step flow: create → localize → set
  // price. The first step alone leaves the IAP/sub in an unsubmittable
  // state because Apple requires both an en-US localization and a
  // USA price schedule before the row can move past Draft. We do
  // the whole chain here so a single Sync click takes the catalog
  // from "kit-only" to "Ready to Submit" in App Store Connect.
  // Submission itself (screenshot upload + inAppPurchaseSubmissions
  // POST) is a follow-up because it needs a screenshot file and a
  // dashboard upload slot we haven't built yet — see TODO below.
  if (direction === "push" || direction === "both") {
    await checkCancelled();
    await reportPhase("push-drafts", {
      current: pulled,
      failuresCount: failures.length,
    });
    const drafts = await ctx.runQuery(
      internal.products.sync.listDraftIosProducts,
      { projectId: project._id },
    );
    // Cache subscriptionGroup find-or-create results across the
    // entire push pass so a project with multiple drafts in the
    // same group (Premium Monthly + Premium Yearly + Premium
    // Weekly all referencing groupName="Premium") only triggers
    // one ASC listSubscriptionGroups round-trip — and never two
    // concurrent create calls racing for the same name.
    //
    // Stores the in-flight promise (not the resolved id) so two
    // drafts that hit the same name concurrently share one ASC
    // round-trip. Without this the parallel push fan-out below
    // could race two find-or-create calls for the same group,
    // ending up with one of them returning a 409.
    const groupIdCache = new Map<string, Promise<string>>();
    // Dry-run uses a single up-front listSubscriptionGroups fetch
    // (read-only) so the per-draft preview rendering doesn't
    // re-list the groups for each Subscription row in drafts.
    // Lazy: only fetched on the first Subscription draft we hit
    // in dry-run, so projects without Sub drafts don't pay the
    // call at all.
    let dryRunGroupsCache: Awaited<
      ReturnType<typeof client.listSubscriptionGroups>
    > | null = null;
    const ensureDryRunGroups = async () => {
      if (!dryRunGroupsCache) {
        dryRunGroupsCache = await client.listSubscriptionGroups(appIdStr);
      }
      return dryRunGroupsCache;
    };
    // Bounded-parallel push. ASC throttles aggressively on the
    // mutation endpoints (createSubscription / createInAppPurchase /
    // setPriceSchedule) so the previous sequential `for (const row
    // of drafts)` loop was the safe-but-slow path; a project with
    // 20 draft products waited 20× the per-draft round-trip. Run
    // PUSH_CONCURRENCY drafts in parallel and trade some risk of a
    // 429 (where ASC returns Retry-After we'd surface to the
    // failures array) for an N× speedup.
    //
    // Each draft's create → localize → setPrice steps stay strictly
    // sequential within `processOneDraft` — ASC rejects ordering
    // races on a single resource (a localize call landing before
    // the create propagates returns 409). Cross-draft parallelism
    // is safe because each upstream resource is independent. The
    // groupIdCache holds in-flight promises so concurrent drafts in
    // the same subscription group still issue exactly one
    // findOrCreate call.
    //
    // Concurrency=4 keeps us well under ASC's per-app rate limit
    // (anecdotally ~10 writes/sec before 429s start) while
    // delivering ~4× wall-clock improvement on typical catalogs.
    // mapWithConcurrency preserves input order for the result
    // array (we don't actually use it; failures + pushed are
    // accumulated by mutation).
    const PUSH_CONCURRENCY = 4;
    const processOneDraft = async (
      row: (typeof drafts)[number],
    ): Promise<void> => {
      // Track failures pushed *for this row* via a row-local flag.
      // The previous `failuresAtStart = failures.length` snapshot
      // worked when this loop was sequential, but with
      // mapWithConcurrency (PUSH_CONCURRENCY=4) the shared
      // `failures` array can grow because of OTHER concurrent
      // drafts between the snapshot and the success-gate check —
      // which would block this draft from calling markPushed even
      // though every step for THIS row succeeded.
      //
      // Use a row-local boolean + a recordFailure helper so each
      // draft's success gate is independent of cross-draft noise.
      // A partial setup (create succeeded, localization failed)
      // still leaves the row in Draft with a populated storeRef
      // so the next sync resumes step 2 instead of re-creating
      // the upstream resource.
      let rowHadFailure = false;
      const recordFailure = (failure: {
        productId: string;
        reason: string;
      }) => {
        rowHadFailure = true;
        failures.push(failure);
      };
      try {
        if (row.type === "Subscription") {
          // Resolve the ASC subscriptionGroup from the operator-typed
          // `subscriptionGroupName`. Find-or-create so the operator
          // doesn't have to pre-create the group in ASC's web UI; if
          // they don't pick a name we default to the productId so
          // there's *some* group rather than a hard failure — but
          // surface a non-fatal warning since per-product groups
          // fragment the catalog and break StoreKit 2's
          // upgrade/downgrade flow between Monthly and Yearly tiers
          // (those need to share a group). In dry-run, list groups
          // (read-only) and report which path the real run would
          // take instead of creating anything.
          //
          // Skip both group-resolve and create when this row already
          // has a storeRef from a prior partially-successful sync —
          // re-creating would either duplicate or 409 against ASC.
          const groupName = row.subscriptionGroupName ?? row.productId;
          if (!row.subscriptionGroupName && !row.storeRef && dryRun) {
            // Surface the per-product-group warning in dry-run only
            // so operators see the recommendation while previewing
            // (the most common time to fix the catalog), but a
            // production sync isn't blocked or noisy. Pushing into
            // `failures` would also trip the markPushed gate added
            // for partial-failure resilience.
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
            }
          } else {
            let groupId: string;
            if (dryRun) {
              const groups = await ensureDryRunGroups();
              const existing = groups.data.find(
                (g) => g.attributes.referenceName === groupName,
              );
              groupId = existing?.id ?? "(would-create)";
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
                // If the in-flight call rejects, evict the cached
                // promise so a follow-up draft can retry instead of
                // permanently inheriting the failure.
                cached.catch(() => {
                  if (groupIdCache.get(groupName) === cached) {
                    groupIdCache.delete(groupName);
                  }
                });
              }
              groupId = await cached;
              const result = await client.createSubscription({
                groupId,
                productId: row.productId,
                name: row.title,
                subscriptionPeriod: mapBillingPeriodToAsc(row.billingPeriod),
                reviewNote: row.reviewNote,
              });
              storeRef = result.data.id;
              // Persist the upstream id immediately so a subsequent
              // step's failure doesn't lose the binding (and the
              // next sync sees this row's storeRef populated and
              // skips the create call above).
              await ctx.runMutation(internal.products.sync.markStoreRef, {
                projectId: project._id,
                productId: row.productId,
                platform: "IOS",
                storeRef,
              });
            }
          }
          // Localize so reviewers see the human-readable name +
          // description instead of just the productId. ASC requires
          // at least one locale before submission — failing here
          // doesn't unwind the create (Apple has no rollback) so we
          // record a failure and let the operator retry / fix in
          // ASC web.
          if (dryRun) {
            plannedWrites.push({
              productId: row.productId,
              step: "create en-US localization",
              detail: row.description ?? row.title,
            });
          } else {
            try {
              await client.createSubLocalization({
                subId: storeRef,
                name: row.title,
                description: row.description ?? row.title,
              });
            } catch (error) {
              // 409 Conflict means the en-US localization already
              // exists from a prior partial sync. That's a benign
              // retry — fall through to the price-setting step
              // instead of marking the whole product failed.
              if (!(error instanceof AscApiError && error.status === 409)) {
                recordFailure({
                  productId: `${row.productId} (localization)`,
                  reason:
                    error instanceof Error ? error.message : String(error),
                });
              }
            }
          }
          // Set the USA price by resolving the operator's USD amount
          // → Apple's nearest price-point id. We require currency =
          // "USD" because the dashboard form lets them pick others
          // but we only know the USA tier ladder here; non-USD prices
          // are surfaced as an actionable failure rather than silently
          // mis-priced. In dry-run, skip the lookup (the just-created
          // subscription resource doesn't exist for read-back) and
          // just record intent.
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
              } catch (error) {
                // 409 Conflict means a price schedule already exists
                // for the (subscription, startDate=today) pair from a
                // prior partial sync — Apple keys schedules by date,
                // not by id. Treat as benign retry so the subsequent
                // markPushed step still runs (PR #124
                // (https://github.com/hyodotdev/openiap/pull/124)
                // review).
                if (!(error instanceof AscApiError && error.status === 409)) {
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
          // Only flip state to Ready when every follow-up step
          // succeeded. Partial setups stay in Draft (with storeRef
          // populated) so the next sync resumes the missing pieces.
          if (!dryRun && !rowHadFailure) {
            await ctx.runMutation(internal.products.sync.markPushed, {
              projectId: project._id,
              productId: row.productId,
              platform: "IOS",
              storeRef,
            });
          }
          pushed += 1;
        } else {
          let storeRef: string;
          if (row.storeRef) {
            storeRef = row.storeRef;
            if (dryRun) {
              plannedWrites.push({
                productId: row.productId,
                step: "skip create (resuming partial sync)",
                detail: `existing storeRef=${storeRef}`,
              });
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
            // Same partial-sync resilience as the Subscription
            // branch — persist the upstream id before the
            // localization / price steps that may fail.
            await ctx.runMutation(internal.products.sync.markStoreRef, {
              projectId: project._id,
              productId: row.productId,
              platform: "IOS",
              storeRef,
            });
          }
          if (dryRun) {
            plannedWrites.push({
              productId: row.productId,
              step: "create en-US localization",
              detail: row.description ?? row.title,
            });
          } else {
            try {
              await client.createIapLocalization({
                iapId: storeRef,
                name: row.title,
                description: row.description ?? row.title,
              });
            } catch (error) {
              // Same 409-is-benign rationale as the subscription
              // localization path — see PR #124
              // (https://github.com/hyodotdev/openiap/pull/124) review.
              if (!(error instanceof AscApiError && error.status === 409)) {
                recordFailure({
                  productId: `${row.productId} (localization)`,
                  reason:
                    error instanceof Error ? error.message : String(error),
                });
              }
            }
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
              } catch (error) {
                // Same 409-is-benign rationale as the subscription
                // price schedule path above — Apple keys IAP price
                // schedules by (iapId, startDate) so a same-day
                // retry hits Conflict. Allow the row to proceed to
                // markPushed instead of stalling in Draft.
                if (!(error instanceof AscApiError && error.status === 409)) {
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
          // Same gate as the Subscription branch — only flip Ready
          // when no follow-up step recorded a failure for this row.
          if (!dryRun && !rowHadFailure) {
            await ctx.runMutation(internal.products.sync.markPushed, {
              projectId: project._id,
              productId: row.productId,
              platform: "IOS",
              storeRef,
            });
          }
          pushed += 1;
        }
        // TODO(review-submit): once Settings has an upload slot for a
        // project-level App Review screenshot
        // (`apple_iap_review_screenshot` purpose), add a step here:
        //   1. POST /v1/inAppPurchaseAppStoreReviewScreenshots (reserve)
        //   2. PUT to the returned upload URL (binary)
        //   3. PATCH ...screenshots/{id} with sourceFileChecksum
        //   4. POST /v1/inAppPurchaseSubmissions
        // Until then, the row stops at "Ready to Submit" in ASC and
        // the operator hits Submit manually (or via next app version).
      } catch (error) {
        recordFailure({
          productId: row.productId,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    };
    await mapWithConcurrency(drafts, PUSH_CONCURRENCY, processOneDraft);
  }

  return {
    pulled,
    pushed,
    failures,
    plannedWrites: dryRun ? plannedWrites : undefined,
  };
}

// Lightweight read-only action so the dashboard can populate a
// subscription-group autocomplete without the operator having to copy
// reference names from ASC's web console. Returns just `{id,
// referenceName}` per group — the heavier listSubscriptionsInGroup
// fetch only happens during full pull-sync. Failures bubble back as a
// thrown Error so the dashboard can show a toast and degrade
// gracefully (the field stays a free-text input).
export const listSubscriptionGroupsAppleIOS = action({
  args: { apiKey: v.string() },
  returns: v.array(v.object({ id: v.string(), referenceName: v.string() })),
  handler: async (
    ctx,
    args,
  ): Promise<Array<{ id: string; referenceName: string }>> => {
    const project = await getProjectByApiKey(ctx, args.apiKey);
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
      // Treat missing billingPeriod as monthly. The catalog form
      // makes billingPeriod optional and a missing value commonly
      // means "I forgot to fill this in"; defaulting to monthly is
      // the least destructive interpretation (the operator can fix
      // the row and re-sync).
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
      // Unknown period values used to silently coerce to ONE_MONTH,
      // which provisioned the wrong subscription duration in ASC —
      // a much harder-to-unwind mistake than a failed sync. Throw
      // so the operator sees the typo immediately and the partial-
      // failure tracking in processOneDraft records it as an
      // actionable failure for that row.
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

// Apple represents introductory-offer durations as enum strings
// rather than ISO-8601 like the subscriptionPeriod field. Translate
// to ISO so kit's `offers[].duration` is uniform across stores
// (Play already uses ISO `P1W` / `P1M` / etc.). Unknown values fall
// through as-is so the dashboard can still render whatever Apple
// returned even if Apple ships a new enum value.
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

// Convert ASC introductory offers list into kit's `offers[]` shape.
// Picks rows whose date range covers today (consistent with how
// `pickActivePriceRow` resolves the active price). Free-trial offers
// have no pricePoint — we emit them with no priceAmountMicros.
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
      const raw = point?.attributes?.customerPrice;
      const n = raw ? Number(raw) : Number.NaN;
      const priceAmountMicros = Number.isFinite(n)
        ? Math.round(n * 1_000_000)
        : undefined;
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
    case "PENDING_DEVELOPER_RELEASE":
    case "READY_TO_SUBMIT":
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
