// Thin HTTP wrapper around kit's versioned HTTP surfaces. Each MCP tool calls
// these helpers instead of hand-rolling fetch + error handling, so the
// failure mode (kit unreachable, bad apiKey, validation errors) is the
// same shape across every tool.

import type {
  KitClientPayloadDraftStateResponse,
  KitClientPayloadHistoryResponse,
  KitClientPayloadStateResponse,
  KitClientPayloadVersionResponse,
  KitMetricsResponse as SharedKitMetricsResponse,
  KitMrrCurrencyEntry as SharedKitMrrCurrencyEntry,
  KitProductsResponse as SharedKitProductsResponse,
  KitProductStateResponse,
  KitProductSyncJobResponse,
  KitProductSyncResponse,
  KitProductUpsertResponse,
  KitRemoveClientPayloadResponse,
  KitSaveClientPayloadDraftResponse,
  KitSetClientPayloadResponse,
  KitSubscriptionsResponse,
  KitSubscription,
} from "@hyodotdev/openiap-client-protocol/kit-api";

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
// Live counts and MRR are production only; the response says so.
export interface KitMetricsResponse extends SharedKitMetricsResponse {
  environment: "Production";
}
export type KitMrrCurrencyEntry = SharedKitMrrCurrencyEntry;

// `/v1/subscriptions/revenue` with its additive analytics fields. App SDKs read
// none of them, so the shape lives here rather than in the shared client
// contract; kit's mcp-contract test holds it to the Convex validator.
export type KitRevenueDay = {
  day: string;
  currency: string;
  productId: string;
  platform: "IOS" | "Android";
  activeSubs: number;
  activeTrials?: number;
  newSubs: number;
  trialStarts?: number;
  trialConversions?: number;
  directPaidStarts?: number;
  renewals: number;
  cancellations: number;
  expirations?: number;
  refunds: number;
  revenueMicros: number;
  refundedMicros?: number;
};
export type KitRevenueCohort = {
  month: string;
  currency: string;
  members: number;
  revenueMicros: number;
  refundedMicros: number;
  realizedLtvMicros: number;
  retained: number[];
  trialStarts: number;
  trialConversions: number;
  trialsPending: number;
  observedThrough: string;
};
export type KitRevenueMetricsResponse = {
  days: KitRevenueDay[];
  currencies: string[];
  productIds: string[];
  platforms: Array<"IOS" | "Android">;
  truncated: boolean;
  environment: "Production" | "Sandbox";
  dataState: "not_collected" | "processing" | "zero" | "ready";
  lastRunAt?: number;
  definitionsFromDay?: string;
  trialSplitFromDay?: string;
  pendingLateEvents: number;
  oldestPendingLateDay?: string;
  cohorts?: KitRevenueCohort[];
  cohortsComputedAt?: number;
};
export interface KitRevenueMetricsParams {
  fromDay: string;
  toDay: string;
  environment?: "production" | "sandbox";
  cohorts?: boolean;
}

export interface KitSubscriptionV2 extends Omit<
  KitSubscription,
  "purchaseToken" | "originalTransactionId"
> {
  store?: "apple" | "google" | "amazon" | "horizon";
}
export type EntitlementsResponseV2 = {
  userId: string;
  productIds: string[];
  subscriptions: KitSubscriptionV2[];
};
export type StatusResponseV2 = {
  active: boolean;
  subscription: KitSubscriptionV2 | null;
};

// Operations responses. Kit's mcp-contract test holds each to the Convex
// return type it is served from.
export type KitDeliveryStatus =
  | "pending"
  | "delivering"
  | "delivered"
  | "failed";

export interface KitDeliveryAttempt {
  at: number;
  outcome: "delivered" | "retrying" | "failed";
  statusCode?: number;
  latencyMs?: number;
  errorClass?:
    | "timeout"
    | "dns"
    | "connection_refused"
    | "connection_reset"
    | "tls"
    | "non_public_address"
    | "destination_rejected"
    | "network";
}

export interface KitDelivery {
  _id: string;
  eventId: string;
  eventType: string;
  eventAvailable: boolean;
  destinationId: string;
  destinationHost: string;
  destinationDescription?: string;
  status: KitDeliveryStatus;
  resendable: boolean;
  attempts: number;
  nextAttemptAt: number;
  lastStatusCode?: number;
  lastError?: string;
  deliveredAt?: number;
  lastResendAt?: number;
  attemptHistory: KitDeliveryAttempt[];
  createdAt: number;
  updatedAt: number;
}

export interface KitDeliveriesResponse {
  deliveries: KitDelivery[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface KitResendResponse {
  deliveryId: string;
  eventId: string;
  status: "pending";
}

type KitStore = "apple" | "google" | "horizon" | "amazon";
type KitSubscriptionState =
  | "Active"
  | "InGracePeriod"
  | "InBillingRetry"
  | "Expired"
  | "Revoked"
  | "Refunded"
  | "Paused"
  | "Unknown";

export interface KitInboundNotification {
  _id: string;
  source: string;
  store: KitStore;
  type: string;
  environment: string;
  sourceNotificationId: string;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  userId?: string;
  payloadFingerprint?: string;
  occurredAt: number;
  receivedAt: number;
  appliedAt?: number;
  status: "applied" | "pending";
}

export interface KitInboundNotificationsResponse {
  notifications: KitInboundNotification[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface KitResyncOutcome {
  status: "updated" | "unchanged" | "superseded";
  subscriptionId?: string;
  state?: KitSubscriptionState;
  productId?: string;
  expiresAt?: number;
  willRenew?: boolean;
  emittedEvents: number;
}

export interface KitResyncResponse {
  target: "purchase" | "subscription";
  store: "apple" | "google";
  purchase?: { id: string; state: string; isValid: boolean; changed: boolean };
  subscription?: KitResyncOutcome;
}

export const KIT_PURCHASE_ISSUE_CAUSES = [
  "STORE_PENDING",
  "STORE_UNAVAILABLE",
  "RATE_LIMITED",
  "INAUTHENTIC",
  "PRODUCT_MISMATCH",
  "APP_MISMATCH",
  "MALFORMED_EVIDENCE",
  "SANDBOX_NOT_ALLOWED",
  "STORE_NOT_CONFIGURED",
  "CREDENTIALS_MISSING",
  "CREDENTIALS_REJECTED",
  "VERIFICATION_FAILED",
  "OWNERSHIP_CONFLICT",
  "BIND_LIMIT_REACHED",
] as const;
export type KitPurchaseIssueCause = (typeof KIT_PURCHASE_ISSUE_CAUSES)[number];

export interface KitPurchaseIssue {
  _id: string;
  cause: KitPurchaseIssueCause;
  store: KitStore;
  fingerprint: string;
  productId?: string;
  claimedProductId?: string;
  appUserId?: string;
  environment?: "Sandbox" | "Production";
  retryAfterSec?: number;
  correlationId?: string;
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface KitPurchaseIssuesResponse {
  issues: KitPurchaseIssue[];
  hasMore: boolean;
  nextCursor: string | null;
}

export type KitPurchaseIssuesParams = {
  cause?: KitPurchaseIssueCause;
  store?: KitStore;
  productId?: string;
  appUserId?: string;
  /** Epoch ms; bounds lastSeenAt, inclusive. */
  from?: number;
  to?: number;
  limit?: number;
  cursor?: string;
};

export type KitTimelineItem =
  | {
      kind: "purchase";
      id: string;
      at: number;
      store: KitStore;
      productId?: string;
      state: string;
      isValid: boolean;
    }
  | {
      kind: "subscription";
      id: string;
      at: number;
      store: KitStore;
      productId: string;
      state: KitSubscriptionState;
      expiresAt?: number;
      willRenew?: boolean;
    }
  | {
      kind: "event";
      id: string;
      at: number;
      store: KitStore;
      eventType: string;
      productId?: string;
    }
  | {
      kind: "issue";
      id: string;
      at: number;
      store: KitStore;
      cause: KitPurchaseIssueCause;
      productId?: string;
      count: number;
    };

export interface KitUserTimelineResponse {
  appUserId: string;
  items: KitTimelineItem[];
  truncated: boolean;
}

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
const KIT_REQUEST_TIMEOUT_MS = 30_000;
const MAX_KIT_RESPONSE_BYTES = 1024 * 1024;

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

/**
 * The one network policy for kit calls: no redirects (one would carry the
 * caller's key to another host), a timeout, and a response size cap.
 */
export async function fetchKit(
  url: string,
  init: RequestInit,
): Promise<{ response: Response; text: string }> {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(KIT_REQUEST_TIMEOUT_MS),
  });
  return { response, text: await readBoundedText(response) };
}

async function readBoundedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      received += value.byteLength;
      if (received > MAX_KIT_RESPONSE_BYTES) {
        throw new Error(`kit response exceeds ${MAX_KIT_RESPONSE_BYTES} bytes`);
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
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
    const { response, text } = await fetchKit(`${root}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(loopback ? { [IAPKIT_MCP_LOOPBACK_HEADER]: "1" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
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

  function clientPayloadPath(
    params: { productId: string; platform: "IOS" | "Android" },
    suffix = "",
    extraQuery: Record<string, string> = {},
  ): string {
    const query = new URLSearchParams({
      platform: params.platform,
      ...extraQuery,
    });
    return `/v1/products/client-payload/${encodeURIComponent(params.productId)}${suffix}?${query.toString()}`;
  }

  function withQuery(
    path: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
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
    revenueMetrics: (params: KitRevenueMetricsParams) => {
      const usp = new URLSearchParams({
        fromDay: params.fromDay,
        toDay: params.toDay,
      });
      if (params.environment) usp.set("environment", params.environment);
      if (params.cohorts) usp.set("cohorts", "true");
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
    }) => adminCall<KitClientPayloadStateResponse>(clientPayloadPath(params)),
    setClientPayload: (params: {
      productId: string;
      platform: "IOS" | "Android";
      format: string;
      body: string;
      expectedVersion?: number;
    }) =>
      adminCall<KitSetClientPayloadResponse>(clientPayloadPath(params), {
        method: "PUT",
        body: JSON.stringify({
          format: params.format,
          body: params.body,
          ...(params.expectedVersion !== undefined
            ? { expectedVersion: params.expectedVersion }
            : {}),
        }),
      }),
    removeClientPayload: (params: {
      productId: string;
      platform: "IOS" | "Android";
      expectedVersion?: number;
    }) =>
      adminCall<KitRemoveClientPayloadResponse>(
        clientPayloadPath(
          params,
          "",
          params.expectedVersion !== undefined
            ? { expectedVersion: String(params.expectedVersion) }
            : {},
        ),
        { method: "DELETE" },
      ),
    getClientPayloadDraft: (params: {
      productId: string;
      platform: "IOS" | "Android";
    }) =>
      adminCall<KitClientPayloadDraftStateResponse>(
        clientPayloadPath(params, "/draft"),
      ),
    saveClientPayloadDraft: (params: {
      productId: string;
      platform: "IOS" | "Android";
      format: string;
      body: string;
      expectedDraftRevision?: number;
    }) =>
      adminCall<KitSaveClientPayloadDraftResponse>(
        clientPayloadPath(params, "/draft"),
        {
          method: "PUT",
          body: JSON.stringify({
            format: params.format,
            body: params.body,
            ...(params.expectedDraftRevision !== undefined
              ? { expectedDraftRevision: params.expectedDraftRevision }
              : {}),
          }),
        },
      ),
    publishClientPayload: (params: {
      productId: string;
      platform: "IOS" | "Android";
      expectedVersion?: number;
      expectedDraftRevision?: number;
      note?: string;
    }) =>
      adminCall<KitSetClientPayloadResponse>(
        clientPayloadPath(params, "/publish"),
        {
          method: "POST",
          body: JSON.stringify({
            expectedVersion: params.expectedVersion,
            expectedDraftRevision: params.expectedDraftRevision,
            note: params.note,
          }),
        },
      ),
    listClientPayloadHistory: (params: {
      productId: string;
      platform: "IOS" | "Android";
    }) =>
      adminCall<KitClientPayloadHistoryResponse>(
        clientPayloadPath(params, "/history"),
      ),
    getClientPayloadVersion: (params: {
      productId: string;
      platform: "IOS" | "Android";
      version: number;
    }) =>
      adminCall<KitClientPayloadVersionResponse>(
        clientPayloadPath(params, `/history/${params.version}`),
      ),
    rollbackClientPayload: (params: {
      productId: string;
      platform: "IOS" | "Android";
      toVersion: number;
      expectedVersion?: number;
      note?: string;
    }) =>
      adminCall<KitSetClientPayloadResponse>(
        clientPayloadPath(params, "/rollback"),
        {
          method: "POST",
          body: JSON.stringify({
            toVersion: params.toVersion,
            expectedVersion: params.expectedVersion,
            note: params.note,
          }),
        },
      ),
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
    listDeliveries: (params: {
      status?: KitDeliveryStatus;
      eventType?: string;
      destinationId?: string;
      eventId?: string;
      limit?: number;
      cursor?: string;
    }) =>
      adminCall<KitDeliveriesResponse>(
        withQuery("/v1/webhooks/deliveries", params),
      ),
    resendDelivery: (deliveryId: string) =>
      adminCall<KitResendResponse>(
        `/v1/webhooks/deliveries/${encodeURIComponent(deliveryId)}/resend`,
        { method: "POST" },
      ),
    listInboundNotifications: (params: { limit?: number; cursor?: string }) =>
      adminCall<KitInboundNotificationsResponse>(
        withQuery("/v1/webhooks/notifications", params),
      ),
    listPurchaseIssues: (params: KitPurchaseIssuesParams) =>
      adminCall<KitPurchaseIssuesResponse>(
        withQuery("/v1/purchase/issues", params),
      ),
    resyncFromStore: (
      target: { purchaseId: string } | { subscriptionId: string },
    ) =>
      adminCall<KitResyncResponse>("/v1/subscriptions/resync", {
        method: "POST",
        body: JSON.stringify(target),
      }),
    userTimeline: (userId: string) =>
      adminCall<KitUserTimelineResponse>(
        `/v1/subscriptions/timeline?userId=${encodeURIComponent(userId)}`,
      ),
    health: () => call<KitHealthResponse>("/health"),
  };
}
