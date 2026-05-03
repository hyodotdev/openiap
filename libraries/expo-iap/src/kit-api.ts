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

const DEFAULT_BASE_URL = "https://kit.openiap.dev";

// Merge caller-supplied headers with kit defaults (`accept`,
// optionally `content-type`). When the runtime exposes a global
// `Headers` constructor we use it directly so callers passing a
// `Headers` instance (a `HeadersInit`) keep that exact instance's
// values. When `Headers` is missing — older React Native builds where
// the operator wires up `fetchImpl` without a `Headers` polyfill —
// we fall back to a case-insensitive merge into a plain record so
// the request still goes through. Either way, caller-set values take
// precedence over kit defaults.
function mergeHeaders(
  callerHeaders: HeadersInit | undefined,
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
  // Plain-object fallback path. Build a case-insensitive name map
  // from whatever the caller passed (Headers-shaped, array-of-pairs,
  // or plain record) and re-emit as a record `fetchImpl` accepts.
  const lower = new Map<string, { name: string; value: string }>();
  const setIfAbsent = (name: string, value: string) => {
    const key = name.toLowerCase();
    if (!lower.has(key)) lower.set(key, { name, value });
  };
  const setForce = (name: string, value: string) => {
    const key = name.toLowerCase();
    lower.set(key, { name, value });
  };
  if (callerHeaders) {
    if (Array.isArray(callerHeaders)) {
      for (const [name, value] of callerHeaders) setForce(name, value);
    } else if (
      typeof (callerHeaders as { forEach?: unknown }).forEach === "function"
    ) {
      // `Headers`-like (without being our `typeof Headers === "function"`
      // global). RN polyfills sometimes attach `Headers` only to
      // request/response instances rather than the global scope.
      // Standard signature is `forEach((value, key, parent))`; we
      // bind the first two positionally so a polyfill that omits
      // the third argument still works. `key` is the header name.
      (
        callerHeaders as {
          forEach: (cb: (value: string, key: string) => void) => void;
        }
      ).forEach((value, key) => setForce(key, value));
    } else {
      for (const [name, value] of Object.entries(
        callerHeaders as Record<string, string>,
      )) {
        setForce(name, value);
      }
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

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    // Normalize headers without depending on a global `Headers`
    // constructor: older React Native runtimes ship `fetch` (or a
    // polyfill via `fetchImpl`) without exposing `Headers` globally.
    // The prior implementation crashed before the first request on
    // those runtimes. We use `new Headers()` when available (preserves
    // caller-supplied `Headers` instances exactly), and otherwise fall
    // back to a small case-insensitive merge into a plain record.
    // Either way, kit defaults only apply when the caller hasn't set
    // the same name.
    const headers = mergeHeaders(init?.headers, init?.body != null);
    // Prepend a leading slash if `path` is missing one. Today's
    // call sites all hard-code the leading "/", but normalizing here
    // makes the helper safe for future additions and matches the
    // already-stripped `baseUrl` (PR #124
    // (https://github.com/hyodotdev/openiap/pull/124) review).
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const response = await fetchImpl(`${baseUrl}${normalizedPath}`, {
      ...init,
      headers,
    });
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
  };
}
