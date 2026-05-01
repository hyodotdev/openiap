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

export type Paywall = {
  slug: string;
  title: string;
  layout: "Single" | "Compare" | "Carousel";
  productIds: string[];
  headline: string;
  subheadline?: string;
  cta: string;
  legalCopy?: string;
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
  };
  updatedAt: number;
};

const DEFAULT_BASE_URL = "https://kit.openiap.dev";

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
  const fetchImpl: (
    input: string,
    init?: RequestInit,
  ) => Promise<Response> = (() => {
    if (options.fetchImpl) return options.fetchImpl;
    if (typeof fetch === "function") {
      return (input: string, init?: RequestInit) => fetch(input, init);
    }
    throw new Error(
      "kitApi requires a fetch implementation. Pass `fetchImpl` for runtimes without a global fetch.",
    );
  })();

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    // Normalize headers via the Headers constructor so caller-supplied
    // `Headers` instances (which are not plain objects) survive the
    // merge — the prior object-spread silently dropped any header
    // passed as a `Headers` instance, including auth headers. Caller
    // headers win over kit defaults if they explicitly set the same
    // name; we set defaults via `set` then re-apply caller values
    // after the fact.
    const headers = new Headers(init?.headers);
    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }
    if (init?.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
    const text = await response.text();
    let parsed: unknown = text;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // leave as text — surfaces verbatim on error
      }
    }
    if (!response.ok) {
      throw new KitApiError(
        response.status,
        parsed,
        `kit ${path} returned ${response.status}`,
      );
    }
    return parsed as T;
  }

  function paywallUrl(slug: string): string {
    return `${baseUrl}/v1/paywalls/${encodeURIComponent(options.apiKey)}/${encodeURIComponent(slug)}`;
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

    /** GET /v1/paywalls/:apiKey/:slug as JSON. */
    getPaywall: (slug: string) =>
      call<Paywall>(
        `/v1/paywalls/${encodeURIComponent(options.apiKey)}/${encodeURIComponent(slug)}`,
        { headers: { accept: "application/json" } },
      ),

    /** Build the URL the host app should load in its WebView /
     * browser to render the hosted paywall. The HTML page emits a
     * `{ openiap: 'purchase', productId }` message via the platform's
     * WebView bridge. */
    paywallUrl,
  };
}
