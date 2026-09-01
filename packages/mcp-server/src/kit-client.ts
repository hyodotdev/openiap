// Thin HTTP wrapper around kit's versioned HTTP surfaces. Each MCP tool calls
// these helpers instead of hand-rolling fetch + error handling, so the
// failure mode (kit unreachable, bad apiKey, validation errors) is the
// same shape across every tool.

import type {
  KitClientPayloadStateResponse,
  KitMetricsResponse as SharedKitMetricsResponse,
  KitMrrCurrencyEntry as SharedKitMrrCurrencyEntry,
  KitProductsResponse as SharedKitProductsResponse,
  KitProductStateResponse,
  KitProductSyncJobResponse,
  KitProductSyncResponse,
  KitProductUpsertResponse,
  KitRemoveClientPayloadResponse,
  KitRevenueMetricsResponse,
  KitSetClientPayloadResponse,
  KitSubscriptionsResponse,
  KitSubscription,
} from "@hyodotdev/openiap-gql/kit-api";

export type KitClientOptions = {
  baseUrl?: string;
  apiKey: string;
};

export interface KitProductListParams {
  platform?: "IOS" | "Android";
  limit?: number;
  cursor?: string;
}

export type KitProductsResponse = SharedKitProductsResponse;
export type KitMetricsResponse = SharedKitMetricsResponse;
export type KitMrrCurrencyEntry = SharedKitMrrCurrencyEntry;

export type KitSubscriptionV2 = Omit<
  KitSubscription,
  "purchaseToken" | "originalTransactionId"
>;
export type EntitlementsResponseV2 = {
  userId: string;
  productIds: string[];
  subscriptions: KitSubscriptionV2[];
};
export type StatusResponseV2 = {
  active: boolean;
  subscription: KitSubscriptionV2 | null;
};

export interface KitHealthResponse {
  ok: true;
  status: "healthy";
  service: "iapkit";
  apiVersion: "v1";
  revision: string | null;
  environment: string;
  timestamp: string;
}

const DEFAULT_BASE_URL = "https://kit.openiap.dev";
export const IAPKIT_MCP_LOOPBACK_HEADER = "x-iapkit-mcp-loopback";

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
  const hostname = new URL(root).hostname;
  const loopback =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1";

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${root}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(loopback ? { [IAPKIT_MCP_LOOPBACK_HEADER]: "1" } : {}),
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
        `kit ${path} returned ${response.status}`,
      );
    }
    return parsed as T;
  }

  function adminCall<T>(path: string, init: RequestInit = {}): Promise<T> {
    return call<T>(path, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        authorization: `Bearer ${apiKey}`,
      },
    });
  }

  return {
    apiKey,
    baseUrl: root,
    status: (userId: string) =>
      adminCall<StatusResponseV2>(
        `/v2/subscriptions/status?userId=${encodeURIComponent(userId)}`,
      ),
    entitlements: (userId: string) =>
      adminCall<EntitlementsResponseV2>(
        `/v2/subscriptions/entitlements?userId=${encodeURIComponent(userId)}`,
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
      return adminCall<KitSubscriptionsResponse>(
        `/v1/subscriptions/list${qs ? `?${qs}` : ""}`,
      );
    },
    metrics: () => adminCall<KitMetricsResponse>("/v1/subscriptions/metrics"),
    revenueMetrics: (params: { fromDay: string; toDay: string }) => {
      const usp = new URLSearchParams({
        fromDay: params.fromDay,
        toDay: params.toDay,
      });
      return adminCall<KitRevenueMetricsResponse>(
        `/v1/subscriptions/revenue?${usp.toString()}`,
      );
    },
    listProducts: (params: KitProductListParams = {}) => {
      const usp = new URLSearchParams();
      if (params.platform) usp.set("platform", params.platform);
      if (params.limit !== undefined) usp.set("limit", String(params.limit));
      if (params.cursor !== undefined) usp.set("cursor", params.cursor);
      const qs = usp.toString();
      return adminCall<KitProductsResponse>(
        `/v1/products${qs ? `?${qs}` : ""}`,
      );
    },
    upsertProduct: (product: {
      productId: string;
      platform: "IOS" | "Android";
      type: "Subscription" | "NonConsumable" | "Consumable";
      title: string;
      description?: string;
      localizations?: Array<{
        locale: string;
        title: string;
        description?: string;
      }>;
      regions?: "all" | string[];
      priceAmountMicros?: number;
      currency?: string;
      billingPeriod?: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
      subscriptionGroupName?: string;
      reviewNote?: string;
    }) =>
      adminCall<KitProductUpsertResponse>("/v1/products", {
        method: "POST",
        body: JSON.stringify(product),
      }),
    setProductState: (params: {
      productId: string;
      platform: "IOS" | "Android";
      state: "Draft" | "Ready" | "Active" | "Removed";
    }) =>
      adminCall<KitProductStateResponse>("/v1/products/state", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    getClientPayloadState: (params: {
      productId: string;
      platform: "IOS" | "Android";
    }) =>
      adminCall<KitClientPayloadStateResponse>(
        `/v1/products/client-payload/${encodeURIComponent(params.productId)}?platform=${encodeURIComponent(params.platform)}`,
      ),
    setClientPayload: (params: {
      productId: string;
      platform: "IOS" | "Android";
      format: string;
      body: string;
      expectedVersion?: number;
    }) =>
      adminCall<KitSetClientPayloadResponse>(
        `/v1/products/client-payload/${encodeURIComponent(params.productId)}?platform=${encodeURIComponent(params.platform)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            format: params.format,
            body: params.body,
            ...(params.expectedVersion !== undefined
              ? { expectedVersion: params.expectedVersion }
              : {}),
          }),
        },
      ),
    removeClientPayload: (params: {
      productId: string;
      platform: "IOS" | "Android";
      expectedVersion?: number;
    }) => {
      const query = new URLSearchParams({ platform: params.platform });
      if (params.expectedVersion !== undefined) {
        query.set("expectedVersion", String(params.expectedVersion));
      }
      return adminCall<KitRemoveClientPayloadResponse>(
        `/v1/products/client-payload/${encodeURIComponent(params.productId)}?${query.toString()}`,
        {
          method: "DELETE",
        },
      );
    },
    syncProducts: (params: {
      platform: "IOS" | "Android";
      direction: "pull" | "push" | "both" | "purge-local";
      dryRun: boolean;
    }) => {
      const platformPath = params.platform === "IOS" ? "ios" : "android";
      const usp = new URLSearchParams({
        direction: params.direction,
        dryRun: String(params.dryRun),
      });
      return adminCall<KitProductSyncResponse>(
        `/v1/products/sync/${platformPath}?${usp.toString()}`,
        { method: "POST" },
      );
    },
    syncJob: (jobId: string) =>
      adminCall<KitProductSyncJobResponse>(
        `/v1/products/sync/jobs/${encodeURIComponent(jobId)}`,
      ),
    health: () => call<KitHealthResponse>("/health"),
  };
}
