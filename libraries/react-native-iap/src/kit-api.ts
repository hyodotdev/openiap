// Tiny fetch wrapper around kit's `/v1` HTTP surface for use by the JS
// SDK consumers (react-native-iap + expo-iap). Mirrors the shape of
// `packages/mcp-server/src/kit-client.ts` so the same operations are
// reachable from both LLM tools and end-user apps without each
// duplicating the URL layout.

export type KitApiOptions = {
  apiKey: string;
  baseUrl?: string;
  // Optional fetch override for runtimes without a global (older RN
  // builds) or for injection in tests.
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  /** Optional AsyncStorage-compatible persistent cache for direct client
   * payload reads. Cache failures never change a successful API result. */
  clientPayloadCache?: KitClientPayloadCache;
};

export type KitClientPayloadCache = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem?: (key: string) => Promise<void> | void;
};

export type KitClientPayloadOptions = {
  /** Revalidate a cached payload with its scoped ETag. Without this flag,
   * a valid persistent entry is returned without a network request. */
  refresh?: boolean;
};

export type KitSubscription = {
  id: string;
  productId: string;
  platform: "IOS" | "Android";
  state: string;
  expiresAt?: number;
  renewsAt?: number;
  willRenew?: boolean;
  cancellationReason?: string;
  currency?: string;
  priceAmountMicros?: number;
  startedAt: number;
  updatedAt: number;
  purchaseToken: string;
  userId?: string;
};

export type EntitlementsResponse = {
  userId: string;
  productIds: string[];
  subscriptions: KitSubscription[];
};

export type StatusResponse = {
  active: boolean;
  subscription: KitSubscription | null;
};

export type KitProductPlatform = "IOS" | "Android";

export type KitProductClientPayload = {
  format: "toml" | "json" | "text";
  body: string;
  version: number;
  updatedAt: number;
};

export type KitProductOffer = {
  id: string;
  kind:
    | "FreeTrial"
    | "IntroPayUpFront"
    | "IntroPayAsYouGo"
    | "PromotionalOffer"
    | "BasePlan";
  duration?: string;
  numberOfPeriods?: number;
  priceAmountMicros?: number;
  currency?: string;
};

export type KitProduct = {
  productId: string;
  platform: KitProductPlatform;
  type: "Subscription" | "NonConsumable" | "Consumable";
  title: string;
  description?: string;
  priceAmountMicros?: number;
  currency?: string;
  state: "Draft" | "Ready" | "Active" | "Removed";
  storeRef?: string;
  subscriptionGroupId?: string;
  subscriptionGroupName?: string;
  billingPeriod?: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
  offers?: KitProductOffer[];
  updatedAt: number;
  clientPayload?: KitProductClientPayload;
};

export type KitProductsOptions = {
  platform?: KitProductPlatform;
  /** Include public client payload bodies in a bounded platform page. */
  includeClientPayload?: boolean;
  /** Page size for every catalog read (default 25, maximum 50). */
  limit?: number;
  /** Opaque cursor returned as `nextCursor` by the previous page. */
  cursor?: string;
};

export type KitProductsResponse = {
  products: KitProduct[];
  hasMore: boolean;
  /** Present when a catalog page has another page. */
  nextCursor?: string;
};

export type KitClientPayloadResponse = {
  clientPayload: KitProductClientPayload;
};

type CachedClientPayload = KitClientPayloadResponse & {
  etag?: string;
};

type InternalRequestInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
};

const DEFAULT_BASE_URL = "https://kit.openiap.dev";

// Merge the request's internal headers with kit defaults (`accept`,
// optionally `content-type`). When `Headers` is missing — older React
// Native builds where the operator wires up `fetchImpl` without a
// `Headers` polyfill — the internal request sites use plain records,
// so a small case-insensitive merge is sufficient.
function mergeHeaders(
  callerHeaders: Record<string, string> | undefined,
  hasBody: boolean,
): HeadersInit {
  if (typeof Headers === "function") {
    const merged = new Headers(callerHeaders);
    if (!merged.has("accept")) merged.set("accept", "application/json");
    if (hasBody && !merged.has("content-type")) {
      merged.set("content-type", "application/json");
    }
    return merged;
  }
  // Plain-object fallback path. Build a case-insensitive name map and
  // re-emit it as a record `fetchImpl` accepts.
  const lower = new Map<string, { name: string; value: string }>();
  const setIfAbsent = (name: string, value: string) => {
    const key = name.toLowerCase();
    if (!lower.has(key)) lower.set(key, { name, value });
  };
  if (callerHeaders) {
    for (const [name, value] of Object.entries(callerHeaders)) {
      lower.set(name.toLowerCase(), { name, value });
    }
  }
  setIfAbsent("accept", "application/json");
  if (hasBody) setIfAbsent("content-type", "application/json");
  const out: Record<string, string> = {};
  for (const { name, value } of lower.values()) out[name] = value;
  return out;
}

export class KitApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "KitApiError";
  }
}

export function kitApi(options: KitApiOptions) {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl: (input: string, init?: RequestInit) => Promise<Response> =
    (() => {
      if (options.fetchImpl) return options.fetchImpl;
      if (typeof fetch === "function") {
        return (input: string, init?: RequestInit) => fetch(input, init);
      }
      throw new Error(
        "kitApi requires a fetch implementation. Pass `fetchImpl` for runtimes without a global fetch.",
      );
    })();

  async function request(
    path: string,
    init?: InternalRequestInit,
  ): Promise<Response> {
    // Normalize headers without depending on a global `Headers`
    // constructor: older React Native runtimes ship `fetch` (or a
    // polyfill via `fetchImpl`) without exposing `Headers` globally.
    // The prior implementation crashed before the first request on
    // those runtimes. We use `new Headers()` when available and
    // otherwise fall back to a small case-insensitive merge into a
    // plain record. Either way, kit defaults only apply when the
    // internal request hasn't set the same name.
    const headers = mergeHeaders(init?.headers, init?.body != null);
    // Prepend a leading slash if `path` is missing one. Today's
    // call sites all hard-code the leading "/", but normalizing here
    // makes the helper safe for future additions and matches the
    // already-stripped `baseUrl` (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return fetchImpl(`${baseUrl}${normalizedPath}`, {
      ...init,
      headers,
    });
  }

  async function parseResponse<T>(
    response: Response,
    path: string,
  ): Promise<T> {
    const text = await response.text();
    // Empty body normalizes to null so callers expecting JSON
    // (status / entitlements / list*) don't get a truthy ""
    // and crash on property access.
    let parsed: unknown = null;
    let parseError: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        // Non-JSON body (a misconfigured proxy returning HTML, a
        // CDN-injected error page, etc.) on a 2xx response would
        // otherwise reach the caller as `parsed = text` and crash
        // on property access via `parsed as T`. Throw a structured
        // KitApiError instead so callers see a typed failure.
        parseError = error;
      }
    }
    if (!response.ok) {
      // Surface the raw body (text or parsed) on the error path so
      // operators can read the upstream error message verbatim.
      throw new KitApiError(
        response.status,
        parsed ?? text,
        `kit ${path} returned ${response.status}`,
      );
    }
    if (parseError) {
      throw new KitApiError(
        response.status,
        text,
        `kit ${path} returned a non-JSON ${response.status} body (${
          parseError instanceof Error ? parseError.message : String(parseError)
        })`,
      );
    }
    return parsed as T;
  }

  async function call<T>(path: string, init?: InternalRequestInit): Promise<T> {
    return parseResponse<T>(await request(path, init), path);
  }

  function clientPayloadCacheKey(
    productId: string,
    platform: KitProductPlatform,
  ): string {
    return [
      "iapkit-client-payload-v1",
      baseUrl,
      options.apiKey,
      platform,
      productId,
    ]
      .map(encodeURIComponent)
      .join(":");
  }

  async function readCachedClientPayload(
    cacheKey: string,
  ): Promise<CachedClientPayload | null> {
    if (!options.clientPayloadCache) return null;
    try {
      const raw = await options.clientPayloadCache.getItem(cacheKey);
      if (!raw) return null;
      const candidate = JSON.parse(raw) as Partial<CachedClientPayload>;
      const payload = candidate.clientPayload;
      // Only the invariants the cache itself depends on. `format` is opaque
      // here: rejecting a format IAPKit added later would evict the entry,
      // stop the ETag revalidation below from ever being sent, and leave
      // offline reads with nothing — for a value the live path passes through
      // to the caller unchanged anyway.
      if (
        !payload ||
        typeof payload.format !== "string" ||
        typeof payload.body !== "string" ||
        !Number.isSafeInteger(payload.version) ||
        payload.version < 1 ||
        typeof payload.updatedAt !== "number" ||
        (candidate.etag !== undefined && typeof candidate.etag !== "string")
      ) {
        await options.clientPayloadCache.removeItem?.(cacheKey);
        return null;
      }
      return candidate as CachedClientPayload;
    } catch {
      return null;
    }
  }

  async function writeCachedClientPayload(
    cacheKey: string,
    value: CachedClientPayload,
  ): Promise<void> {
    try {
      await options.clientPayloadCache?.setItem(
        cacheKey,
        JSON.stringify(value),
      );
    } catch {
      // Persistence is an optimization. A device storage failure must not
      // turn a successful IAPKit read into an application error.
    }
  }

  async function removeCachedClientPayload(cacheKey: string): Promise<void> {
    try {
      await options.clientPayloadCache?.removeItem?.(cacheKey);
    } catch {
      // See writeCachedClientPayload: cache maintenance is best effort.
    }
  }

  return {
    apiKey: options.apiKey,
    baseUrl,

    /** GET /v1/subscriptions/status — the `active` boolean is the
     * fastest gate for "is this user paying?". */
    status: (userId: string) =>
      call<StatusResponse>(
        `/v1/subscriptions/status/${encodeURIComponent(options.apiKey)}?userId=${encodeURIComponent(userId)}`,
      ),

    /** GET /v1/subscriptions/entitlements — every productId the user
     * is entitled to. Use this when feature gating depends on which
     * specific tier the user owns. */
    entitlements: (userId: string) =>
      call<EntitlementsResponse>(
        `/v1/subscriptions/entitlements/${encodeURIComponent(options.apiKey)}?userId=${encodeURIComponent(userId)}`,
      ),

    /** GET /v1/products — read the store-synced catalog. Client payloads
     * are excluded unless explicitly requested because they may add up to
     * 16 KiB per product. */
    products: (productOptions: KitProductsOptions = {}) => {
      if (
        productOptions.includeClientPayload === true &&
        !productOptions.platform
      ) {
        throw new Error(
          "kitApi.products requires platform when includeClientPayload is true",
        );
      }
      const query = new URLSearchParams();
      if (productOptions.platform) {
        query.set("platform", productOptions.platform);
      }
      if (productOptions.includeClientPayload !== undefined) {
        query.set(
          "includeClientPayload",
          String(productOptions.includeClientPayload),
        );
      }
      if (productOptions.limit !== undefined) {
        query.set("limit", String(productOptions.limit));
      }
      if (productOptions.cursor !== undefined) {
        query.set("cursor", productOptions.cursor);
      }
      const encodedQuery = query.toString();
      const suffix = encodedQuery ? `?${encodedQuery}` : "";
      return call<KitProductsResponse>(
        `/v1/products/${encodeURIComponent(options.apiKey)}${suffix}`,
      );
    },

    /** GET one public client payload by its store-specific natural key.
     * Payloads are app-facing data; never store secrets in them. */
    clientPayload: async (
      productId: string,
      platform: KitProductPlatform,
      payloadOptions: KitClientPayloadOptions = {},
    ) => {
      const path = `/v1/products/${encodeURIComponent(options.apiKey)}/${encodeURIComponent(productId)}/client-payload?platform=${encodeURIComponent(platform)}`;
      const cacheKey = clientPayloadCacheKey(productId, platform);
      const cached = await readCachedClientPayload(cacheKey);
      if (cached && payloadOptions.refresh !== true) {
        return { clientPayload: cached.clientPayload };
      }
      const response = await request(path, {
        ...(cached?.etag ? { headers: { "If-None-Match": cached.etag } } : {}),
      });
      if (response.status === 304 && cached) {
        return { clientPayload: cached.clientPayload };
      }
      try {
        const result = await parseResponse<KitClientPayloadResponse>(
          response,
          path,
        );
        await writeCachedClientPayload(cacheKey, {
          ...result,
          ...(response.headers.get("etag")
            ? { etag: response.headers.get("etag")! }
            : {}),
        });
        return result;
      } catch (error) {
        if (error instanceof KitApiError && error.status === 404) {
          await removeCachedClientPayload(cacheKey);
        }
        throw error;
      }
    },

    /** POST /v1/subscriptions/bind-user — call after a successful
     * verifyReceipt so kit knows which userId owns the verified
     * `purchaseToken`. Idempotent. */
    bindUser: (purchaseToken: string, userId: string) =>
      call<{ ok: boolean; bound: boolean }>(
        `/v1/subscriptions/bind-user/${encodeURIComponent(options.apiKey)}`,
        {
          method: "POST",
          body: JSON.stringify({ purchaseToken, userId }),
        },
      ),
  };
}
