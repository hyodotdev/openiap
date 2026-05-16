// Thin HTTP wrapper around kit's `/v1` surface. Each MCP tool calls
// these helpers instead of hand-rolling fetch + error handling, so the
// failure mode (kit unreachable, bad apiKey, validation errors) is the
// same shape across every tool.

export type KitClientOptions = {
  baseUrl?: string;
  apiKey: string;
};

const DEFAULT_BASE_URL = "https://kit.openiap.dev";

export function normalizeKitBaseUrl(baseUrl?: string): string {
  let url: URL;
  const raw = baseUrl ?? DEFAULT_BASE_URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("kit baseUrl must be a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("kit baseUrl must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("kit baseUrl must not include credentials");
  }
  if (url.search || url.hash) {
    throw new Error("kit baseUrl must not include query or fragment");
  }
  return url.href.replace(/\/+$/, "");
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;

  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  return (
    mediaType === "application/json" ||
    Boolean(
      mediaType?.startsWith("application/") && mediaType.endsWith("+json"),
    )
  );
}

export class KitHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "KitHttpError";
  }
}

export function kitClient({ baseUrl, apiKey }: KitClientOptions) {
  const root = normalizeKitBaseUrl(baseUrl);

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${root}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const text = await response.text();
    // Empty body normalizes to null so callers expecting JSON don't
    // get a truthy "" and crash on property access.
    let parsed: unknown = text === "" ? null : text;
    if (text && isJsonContentType(response.headers.get("content-type"))) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // leave as text — surfaced verbatim in the error
      }
    }
    if (!response.ok) {
      throw new KitHttpError(
        response.status,
        parsed,
        `kit ${redactKitApiKeyPath(path)} returned ${response.status}`,
      );
    }
    return parsed as T;
  }

  return {
    apiKey,
    baseUrl: root,
    status: (userId: string) =>
      call<{ active: boolean; subscription: unknown }>(
        `/v1/subscriptions/status/${encodeURIComponent(apiKey)}?userId=${encodeURIComponent(userId)}`,
      ),
    entitlements: (userId: string) =>
      call<{ userId: string; productIds: string[]; subscriptions: unknown[] }>(
        `/v1/subscriptions/entitlements/${encodeURIComponent(apiKey)}?userId=${encodeURIComponent(userId)}`,
      ),
    listSubscriptions: (params: {
      state?: string;
      productId?: string;
      userId?: string;
      limit?: number;
    }) => {
      const usp = new URLSearchParams();
      if (params.state) usp.set("state", params.state);
      if (params.productId) usp.set("productId", params.productId);
      if (params.userId) usp.set("userId", params.userId);
      if (params.limit) usp.set("limit", String(params.limit));
      const qs = usp.toString();
      return call<{ items: unknown[]; total?: number }>(
        `/v1/subscriptions/list/${encodeURIComponent(apiKey)}${qs ? `?${qs}` : ""}`,
      );
    },
    metrics: () =>
      call<{
        activeSubs: number;
        inGracePeriod: number;
        inBillingRetry: number;
        refunded30d: number;
        canceled30d: number;
        mrrMicros: number;
        currency?: string;
      }>(`/v1/subscriptions/metrics/${encodeURIComponent(apiKey)}`),
    listProducts: (params: { platform?: "IOS" | "Android" } = {}) => {
      const usp = new URLSearchParams();
      if (params.platform) usp.set("platform", params.platform);
      const qs = usp.toString();
      return call<{ products: unknown[] }>(
        `/v1/products/${encodeURIComponent(apiKey)}${qs ? `?${qs}` : ""}`,
      );
    },
    upsertProduct: (product: {
      productId: string;
      platform: "IOS" | "Android";
      type: "Subscription" | "NonConsumable" | "Consumable";
      title: string;
      description?: string;
      priceAmountMicros?: number;
      currency?: string;
      billingPeriod?: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
      subscriptionGroupName?: string;
      reviewNote?: string;
    }) =>
      call<{ id: string; created: boolean }>(
        `/v1/products/${encodeURIComponent(apiKey)}`,
        { method: "POST", body: JSON.stringify(product) },
      ),
    setProductState: (params: {
      productId: string;
      platform: "IOS" | "Android";
      state: "Draft" | "Ready" | "Active" | "Removed";
    }) =>
      call<{ id: string; state: string }>(
        `/v1/products/${encodeURIComponent(apiKey)}/state`,
        { method: "POST", body: JSON.stringify(params) },
      ),
    health: () => call<{ ok: boolean }>("/health"),
  };
}

export function redactKitApiKeyPath(path: string): string {
  return path.replace(
    /^((?:\/api)?\/v1\/(?:products|subscriptions\/(?:status|entitlements|list|metrics|bind-user)|webhooks(?:\/(?:apple|google|stream))?)\/)[^\/?#]+/,
    "$1<api-key-redacted>",
  );
}
