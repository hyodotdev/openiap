import * as crypto from "node:crypto";
import { Buffer } from "node:buffer";
import type { FunctionReturnType } from "convex/server";
import { Hono, type Context, type Next } from "hono";

import { api } from "@/convex";
import { client, handleConvexError } from "../../convex";
import {
  legacySubscriptionUsageLoggerMiddleware,
  redactApiKeysInPath,
} from "./request-logger";
import { apiKeyPreview } from "../../../convex/apiKeys/helpers";
import {
  apiKeyMiddleware,
  apiKeyValidationError,
  isSecretApiKey,
  secretAdminApiKeyMiddleware,
} from "./middleware";
import {
  APPLE_JWS_PATTERN,
  APPLE_JWS_MAX_LENGTH,
  GOOGLE_PURCHASE_TOKEN_MAX_LENGTH,
} from "./route-input-schemas";
import {
  isContentLengthOverLimit,
  JsonBodyTooLargeError,
  readJsonBodyWithLimit,
} from "./request-body";
import { multiAxisRateLimitMiddleware } from "./rate-limit";
import {
  isValidSubscriptionUserId,
  MAX_SUBSCRIPTION_USER_ID_LENGTH,
} from "../../../convex/subscriptions/limits";

// Subscription state, entitlements, metrics, and user-binding routes.
// Mirrors the role of onesub's `/onesub/status`, `/onesub/admin/...`
// and `/onesub/metrics/*` endpoints. App-facing compatibility routes keep the
// publishable apiKey in the path for RN fetch implementations that strip
// headers. Canonical administrative routes accept a Bearer secret so MCP and
// trusted servers keep credentials out of URLs.

const subscriptions = new Hono<{
  Variables: {
    apiKey: string;
    apiKeyHash?: string;
    legacySubscriptionProjectId?: string;
  };
}>();
const publicApiRateLimit = multiAxisRateLimitMiddleware();
const MAX_PRODUCT_ID_LENGTH = 256;
const MAX_BIND_USER_BODY_BYTES = 32 * 1024;
const SUBSCRIPTION_USER_ID_LIMIT_MESSAGE = `userId must be ≤ ${MAX_SUBSCRIPTION_USER_ID_LENGTH} chars`;
const INVALID_APPLE_JWS_PURCHASE_TOKEN_MESSAGE =
  "purchaseToken must be a valid Apple JWS containing originalTransactionId or transactionId";
type SubscriptionEvaluationSnapshot = FunctionReturnType<
  typeof api.subscriptions.query.subscriptionEvaluationSnapshot
>;
type SubscriptionSnapshotRow =
  SubscriptionEvaluationSnapshot["candidates"][number];
type PublicSubscriptionSnapshotRow = Omit<SubscriptionSnapshotRow, "createdAt">;
type SubscriptionState = SubscriptionSnapshotRow["state"];
const SUBSCRIPTION_STATES = new Set<string>([
  "Active",
  "InGracePeriod",
  "InBillingRetry",
  "Expired",
  "Revoked",
  "Refunded",
  "Paused",
  "Unknown",
]);
const API_KEY_ROUTES = [
  "/status/:apiKey",
  "/entitlements/:apiKey",
  "/list/:apiKey",
  "/metrics/:apiKey",
  "/revenue/:apiKey",
  "/bind-user/:apiKey",
];

for (const route of API_KEY_ROUTES) {
  subscriptions.use(route, pathApiKeyGuard, publicApiRateLimit);
}

async function handleSubscriptionStatus(c: Context, apiKey: string) {
  const userId = c.req.query("userId");
  if (!isNonBlankString(userId)) {
    return invalidInput(c, "userId is required");
  }
  if (!isValidSubscriptionUserId(userId)) {
    return invalidInput(c, SUBSCRIPTION_USER_ID_LIMIT_MESSAGE);
  }
  try {
    const snapshot = await client.query(
      api.subscriptions.query.subscriptionEvaluationSnapshot,
      { apiKey, userId },
    );
    if (snapshot.projectId) {
      c.set("legacySubscriptionProjectId", snapshot.projectId);
    }
    const result = evaluateSubscriptionStatus(snapshot, Date.now());
    return conditionalSubscriptionSnapshot(c, {
      apiKey,
      kind: "status",
      userId,
      result,
    });
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_STATUS_FAILED",
      "Subscription status lookup failed",
    );
  }
}

subscriptions.get(
  "/status",
  apiKeyMiddleware,
  publicApiRateLimit,
  legacySubscriptionUsageLoggerMiddleware("status", "authorization"),
  (c) => handleSubscriptionStatus(c, c.var.apiKey),
);
subscriptions.get(
  "/status/:apiKey",
  legacySubscriptionUsageLoggerMiddleware("status", "path"),
  (c) => handleSubscriptionStatus(c, c.req.param("apiKey")),
);

async function handleEntitlements(c: Context, apiKey: string) {
  const userId = c.req.query("userId");
  if (!isNonBlankString(userId)) {
    return invalidInput(c, "userId is required");
  }
  if (!isValidSubscriptionUserId(userId)) {
    return invalidInput(c, SUBSCRIPTION_USER_ID_LIMIT_MESSAGE);
  }
  try {
    const snapshot = await client.query(
      api.subscriptions.query.subscriptionEvaluationSnapshot,
      { apiKey, userId },
    );
    if (snapshot.projectId) {
      c.set("legacySubscriptionProjectId", snapshot.projectId);
    }
    const result = evaluateEntitlements(
      userId,
      snapshot.candidates,
      Date.now(),
    );
    return conditionalSubscriptionSnapshot(c, {
      apiKey,
      kind: "entitlements",
      userId,
      result,
    });
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_ENTITLEMENTS_FAILED",
      "Subscription entitlements lookup failed",
    );
  }
}

subscriptions.get(
  "/entitlements",
  apiKeyMiddleware,
  publicApiRateLimit,
  legacySubscriptionUsageLoggerMiddleware("entitlements", "authorization"),
  (c) => handleEntitlements(c, c.var.apiKey),
);
subscriptions.get(
  "/entitlements/:apiKey",
  legacySubscriptionUsageLoggerMiddleware("entitlements", "path"),
  (c) => handleEntitlements(c, c.req.param("apiKey")),
);

async function handleListSubscriptions(c: Context, apiKey: string) {
  const stateParam = c.req.query("state");
  const productId = c.req.query("productId");
  const userId = c.req.query("userId");
  const limit = parseLimit(c.req.query("limit"));
  if (limit === null) {
    return invalidInput(c, "limit must be a positive integer");
  }
  if (userId !== undefined && !isNonBlankString(userId)) {
    return invalidInput(c, "userId must not be empty");
  }
  if (productId !== undefined && !isNonBlankString(productId)) {
    return invalidInput(c, "productId must not be empty");
  }
  if (userId !== undefined && !isValidSubscriptionUserId(userId)) {
    return invalidInput(c, SUBSCRIPTION_USER_ID_LIMIT_MESSAGE);
  }
  if (productId !== undefined && !isValidProductIdLength(productId)) {
    return invalidInput(c, "productId must be ≤ 256 chars");
  }
  let state: SubscriptionState | undefined;
  if (stateParam !== undefined) {
    if (!isSubscriptionState(stateParam)) {
      return invalidInput(c, "state is invalid");
    }
    state = stateParam;
  }
  try {
    const result = await client.query(
      api.subscriptions.query.listSubscriptions,
      {
        apiKey,
        state,
        productId: productId ?? undefined,
        userId: userId ?? undefined,
        limit,
      },
    );
    return c.json(result);
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_LIST_FAILED",
      "Subscription list failed",
    );
  }
}

subscriptions.get("/list", apiKeyMiddleware, secretAdminApiKeyMiddleware, (c) =>
  handleListSubscriptions(c, c.var.apiKey),
);
subscriptions.get("/list/:apiKey", secretAdminApiKeyMiddleware, (c) =>
  handleListSubscriptions(c, c.req.param("apiKey")),
);

async function handleMetrics(c: Context, apiKey: string) {
  try {
    const result = await client.query(api.subscriptions.query.metricsSummary, {
      apiKey,
    });
    return c.json(result);
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_METRICS_FAILED",
      "Subscription metrics lookup failed",
    );
  }
}

subscriptions.get(
  "/metrics",
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
  (c) => handleMetrics(c, c.var.apiKey),
);
subscriptions.get("/metrics/:apiKey", secretAdminApiKeyMiddleware, (c) =>
  handleMetrics(c, c.req.param("apiKey")),
);

async function handleRevenueMetrics(c: Context, apiKey: string) {
  const fromDay = c.req.query("fromDay");
  const toDay = c.req.query("toDay");

  if (!isIsoDay(fromDay) || !isIsoDay(toDay)) {
    return invalidInput(c, "fromDay and toDay must be YYYY-MM-DD");
  }
  if (fromDay > toDay) {
    return invalidInput(c, "fromDay must be on or before toDay");
  }
  const spanDays = isoDaySpan(fromDay, toDay);
  if (spanDays === null) {
    return invalidInput(c, "fromDay and toDay must be valid calendar days");
  }
  if (spanDays > 92) {
    return invalidInput(c, "revenue range must be 92 days or less");
  }

  try {
    const result = await client.query(
      api.subscriptions.query.getRevenueMetrics,
      {
        apiKey,
        fromDay,
        toDay,
      },
    );
    return c.json(result);
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_REVENUE_FAILED",
      "Subscription revenue lookup failed",
    );
  }
}

subscriptions.get(
  "/revenue",
  apiKeyMiddleware,
  secretAdminApiKeyMiddleware,
  (c) => handleRevenueMetrics(c, c.var.apiKey),
);
subscriptions.get("/revenue/:apiKey", secretAdminApiKeyMiddleware, (c) =>
  handleRevenueMetrics(c, c.req.param("apiKey")),
);

async function handleBindUser(c: Context, apiKey: string) {
  let body: unknown;
  try {
    body = await readJsonBodyWithLimit(
      c.req.raw,
      MAX_BIND_USER_BODY_BYTES,
      "Subscription payload is too large",
    );
  } catch (error) {
    if (error instanceof JsonBodyTooLargeError) {
      return payloadTooLarge(c);
    }
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }
  if (!isJsonObject(body)) {
    return invalidInput(c, "purchaseToken and userId are required");
  }
  const payload = body as { purchaseToken?: string; userId?: string };
  if (
    !isNonBlankString(payload.purchaseToken) ||
    !isNonBlankString(payload.userId)
  ) {
    return invalidInput(c, "purchaseToken and userId are required");
  }
  const normalizedPurchaseToken = normalizeBindUserPurchaseToken(
    payload.purchaseToken,
  );
  if (!normalizedPurchaseToken.ok) {
    return invalidInput(c, normalizedPurchaseToken.message);
  }
  if (!isValidSubscriptionUserId(payload.userId)) {
    return invalidInput(c, SUBSCRIPTION_USER_ID_LIMIT_MESSAGE);
  }
  try {
    const result = await client.mutation(api.subscriptions.mutation.bindUser, {
      apiKey,
      purchaseToken: normalizedPurchaseToken.purchaseToken,
      userId: payload.userId,
    });
    return c.json(result);
  } catch (error) {
    return subscriptionRouteError(
      c,
      error,
      "SUBSCRIPTION_BIND_USER_FAILED",
      "Subscription user binding failed",
    );
  }
}

subscriptions.post("/bind-user", apiKeyMiddleware, publicApiRateLimit, (c) =>
  handleBindUser(c, c.var.apiKey),
);
subscriptions.post("/bind-user/:apiKey", (c) =>
  handleBindUser(c, c.req.param("apiKey")),
);

function parseLimit(raw: string | undefined): number | undefined | null {
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return Math.min(n, 200);
}

function isValidProductIdLength(productId: string): boolean {
  return productId.length <= MAX_PRODUCT_ID_LENGTH;
}

type BindUserPurchaseTokenResult =
  | { ok: true; purchaseToken: string }
  | { ok: false; message: string };
type AppleJwsParseResult =
  | { kind: "valid"; purchaseToken: string }
  | { kind: "invalid" }
  | { kind: "notAppleJws" };

export function normalizeBindUserPurchaseToken(
  purchaseToken: string,
): BindUserPurchaseTokenResult {
  if (isCompactJwsShape(purchaseToken)) {
    if (purchaseToken.length > APPLE_JWS_MAX_LENGTH) {
      return { ok: false, message: bindUserPurchaseTokenLimitMessage() };
    }

    const appleJws = parseApplePurchaseTokenFromJws(purchaseToken);
    if (appleJws.kind === "valid") {
      return { ok: true, purchaseToken: appleJws.purchaseToken };
    }
    if (appleJws.kind === "invalid") {
      return {
        ok: false,
        message: INVALID_APPLE_JWS_PURCHASE_TOKEN_MESSAGE,
      };
    }
    if (purchaseToken.length <= GOOGLE_PURCHASE_TOKEN_MAX_LENGTH) {
      return { ok: true, purchaseToken };
    }

    return {
      ok: false,
      message: INVALID_APPLE_JWS_PURCHASE_TOKEN_MESSAGE,
    };
  }

  if (purchaseToken.length <= GOOGLE_PURCHASE_TOKEN_MAX_LENGTH) {
    return { ok: true, purchaseToken };
  }

  return { ok: false, message: bindUserPurchaseTokenLimitMessage() };
}

function parseApplePurchaseTokenFromJws(jws: string): AppleJwsParseResult {
  if (!isCompactJwsShape(jws) || jws.length > APPLE_JWS_MAX_LENGTH) {
    return { kind: "notAppleJws" };
  }

  try {
    const [headerBase64, payloadBase64] = jws.split(".");
    const header = decodeJwsJsonPart(headerBase64);
    const payload = decodeJwsJsonPart(payloadBase64);

    if (!isJsonObject(header) || !isJsonObject(payload)) {
      return { kind: "notAppleJws" };
    }

    const originalTransactionId = normalizeTransactionId(
      payload.originalTransactionId,
    );
    if (originalTransactionId) {
      return { kind: "valid", purchaseToken: originalTransactionId };
    }

    const transactionId = normalizeTransactionId(payload.transactionId);
    if (transactionId) {
      return { kind: "valid", purchaseToken: transactionId };
    }
  } catch {
    return { kind: "notAppleJws" };
  }

  return { kind: "invalid" };
}

function isCompactJwsShape(value: string): boolean {
  return APPLE_JWS_PATTERN.test(value);
}

function decodeJwsJsonPart(part: string): unknown {
  const raw = Buffer.from(part, "base64url").toString("utf-8");
  const safeRaw = raw.replace(
    /"((?:originalT|t)ransactionId)"\s*:\s*(\d+)(?=\s*[,}])/g,
    '"$1":"$2"',
  );
  return JSON.parse(safeRaw);
}

function normalizeTransactionId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function bindUserPurchaseTokenLimitMessage(): string {
  return `purchaseToken must be ≤ ${GOOGLE_PURCHASE_TOKEN_MAX_LENGTH} chars, or an Apple JWS ≤ ${APPLE_JWS_MAX_LENGTH} chars`;
}

function isSubscriptionState(state: string): state is SubscriptionState {
  return SUBSCRIPTION_STATES.has(state);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function conditionalSubscriptionSnapshot(
  c: Context,
  args: {
    apiKey: string;
    kind: "status" | "entitlements";
    userId: string;
    result: unknown;
  },
): Response {
  // These app-readable snapshots are user- and project-scoped. A device cache
  // may retain them, but every reuse must be revalidated with IAPKit so an
  // inbound store webhook or time-based expiration can change the response.
  c.header("Vary", "Authorization");
  if (isSecretApiKey(args.apiKey)) {
    c.header("Cache-Control", "private, no-store");
    return c.json(args.result);
  }
  c.header("Cache-Control", "private, no-cache");

  const etag = subscriptionSnapshotEtag(args);
  c.header("ETag", etag);
  if (ifNoneMatchIncludes(c.req.header("if-none-match"), etag)) {
    return c.body(null, 304);
  }

  return c.json(args.result);
}

function evaluateSubscriptionStatus(
  snapshot: SubscriptionEvaluationSnapshot,
  now: number,
): {
  active: boolean;
  subscription: PublicSubscriptionSnapshotRow | null;
} {
  const activeSubscriptions = snapshot.candidates.filter((subscription) =>
    isActiveSubscription(subscription, now),
  );
  const selected = selectMostRecentlyUpdatedSnapshot(activeSubscriptions);
  return {
    active: selected !== null,
    subscription: toPublicSubscriptionRow(selected ?? snapshot.fallback),
  };
}

function evaluateEntitlements(
  userId: string,
  subscriptions: SubscriptionSnapshotRow[],
  now: number,
): {
  userId: string;
  productIds: string[];
  subscriptions: PublicSubscriptionSnapshotRow[];
} {
  const active = subscriptions.filter((subscription) =>
    isActiveSubscription(subscription, now),
  );
  return {
    userId,
    productIds: Array.from(
      new Set(active.map((subscription) => subscription.productId)),
    ),
    subscriptions: active.map((subscription) =>
      toPublicSubscriptionRow(subscription),
    ),
  };
}

export type SubscriptionStatusResponse = ReturnType<
  typeof evaluateSubscriptionStatus
>;
export type SubscriptionEntitlementsResponse = ReturnType<
  typeof evaluateEntitlements
>;

function selectMostRecentlyUpdatedSnapshot(
  subscriptions: readonly SubscriptionSnapshotRow[],
): SubscriptionSnapshotRow | null {
  let selected: SubscriptionSnapshotRow | null = null;
  for (const subscription of subscriptions) {
    if (
      selected === null ||
      subscription.updatedAt > selected.updatedAt ||
      (subscription.updatedAt === selected.updatedAt &&
        subscription.createdAt > selected.createdAt)
    ) {
      selected = subscription;
    }
  }
  return selected;
}

function toPublicSubscriptionRow(
  subscription: SubscriptionSnapshotRow,
): PublicSubscriptionSnapshotRow;
function toPublicSubscriptionRow(subscription: null): null;
function toPublicSubscriptionRow(
  subscription: SubscriptionSnapshotRow | null,
): PublicSubscriptionSnapshotRow | null;
function toPublicSubscriptionRow(
  subscription: SubscriptionSnapshotRow | null,
): PublicSubscriptionSnapshotRow | null {
  if (subscription === null) return null;
  const { createdAt: _createdAt, ...publicSubscription } = subscription;
  return publicSubscription;
}

function isActiveSubscription(
  subscription: SubscriptionSnapshotRow,
  now: number,
): boolean {
  const entitled =
    subscription.state === "Active" || subscription.state === "InGracePeriod";
  if (!entitled) return false;
  return subscription.expiresAt == null || subscription.expiresAt > now;
}

function subscriptionSnapshotEtag(args: {
  apiKey: string;
  kind: "status" | "entitlements";
  userId: string;
  result: unknown;
}): string {
  const digest = crypto
    .createHash("sha256")
    .update(stableJson({ kind: args.kind, result: args.result }))
    .digest("base64url")
    .slice(0, 32);
  return `W/"iapkit-subscription-${args.kind}-${digest}"`;
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalizeForEtag(value));
}

function canonicalizeForEtag(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeForEtag);
  }
  if (!isJsonObject(value)) {
    return value;
  }

  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item !== undefined) {
      canonical[key] = canonicalizeForEtag(item);
    }
  }
  return canonical;
}

function ifNoneMatchIncludes(
  ifNoneMatch: string | undefined,
  etag: string,
): boolean {
  if (!ifNoneMatch) return false;
  const normalizedEtag = normalizeEtagForWeakComparison(etag);
  return ifNoneMatch.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return (
      normalized === "*" ||
      normalizeEtagForWeakComparison(normalized) === normalizedEtag
    );
  });
}

function normalizeEtagForWeakComparison(etag: string): string {
  return etag.replace(/^W\//, "");
}

function isIsoDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoDaySpan(fromDay: string, toDay: string): number | null {
  const fromMs = isoDayStartMs(fromDay);
  const toMs = isoDayStartMs(toDay);
  if (fromMs === null || toMs === null) return null;
  return Math.round((toMs - fromMs) / 86_400_000) + 1;
}

function isoDayStartMs(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const ms = Date.UTC(year, month - 1, date);
  const parsed = new Date(ms);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== date
  ) {
    return null;
  }
  return ms;
}

function invalidInput(c: Context, message: string) {
  return c.json({ errors: [{ code: "INVALID_INPUT", message }] }, 400);
}

function payloadTooLarge(c: Context) {
  return c.json(
    {
      errors: [
        {
          code: "PAYLOAD_TOO_LARGE",
          message: "Subscription payload is too large",
        },
      ],
    },
    413,
  );
}

async function pathApiKeyGuard(c: Context, next: Next) {
  const apiKey = c.req.param("apiKey");
  if (isSecretApiKey(apiKey)) {
    // Rejecting is not containment: the URL has already reached this process,
    // and any proxy, CDN or browser history in front of it kept a copy. Say so,
    // and record it so an operator sees a key that needs rotating.
    console.warn(
      "[subscriptions] a secret key was presented in a URL path and must be rotated",
      {
        path: redactApiKeysInPath(c.req.path, apiKey),
        // Same display form as the dashboard, so the operator can tell WHICH
        // key to rotate without the log holding the secret.
        keyPreview: apiKeyPreview(apiKey),
      },
    );
    return c.json(
      {
        errors: [
          {
            code: "SECRET_API_KEY_IN_URL",
            message:
              "Secret API keys are not accepted in URLs. Use Authorization: Bearer <secret-key> on the canonical route. This key has been exposed in a URL — rotate it.",
          },
        ],
      },
      410,
    );
  }
  const validationError = apiKeyValidationError(apiKey);
  if (validationError) {
    return c.json(
      { errors: [{ code: "INVALID_API_KEY", message: validationError }] },
      403,
    );
  }
  if (
    c.req.method !== "GET" &&
    isContentLengthOverLimit(
      c.req.header("content-length"),
      MAX_BIND_USER_BODY_BYTES,
    )
  ) {
    return payloadTooLarge(c);
  }
  c.set("apiKey", apiKey);
  await next();
}

function subscriptionRouteError(
  c: Context,
  error: unknown,
  code: string,
  fallbackMessage: string,
) {
  const convexError = handleConvexError(error);
  if (convexError) {
    return c.json(
      { errors: [convexError] },
      convexError.code === "INSUFFICIENT_SCOPE" ? 403 : 400,
    );
  }

  console.error(`[subscriptions] ${code}`, describeErrorForLog(error));
  return c.json({ errors: [{ code, message: fallbackMessage }] }, 500);
}

function describeErrorForLog(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

export { subscriptions as subscriptionsRoutes };
